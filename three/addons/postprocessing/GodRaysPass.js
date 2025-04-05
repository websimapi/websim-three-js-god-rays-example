import {
    AdditiveBlending,
    Color,
    LinearFilter,
    MeshBasicMaterial,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    UniformsUtils,
    Vector2,
    Vector3,
    WebGLRenderTarget
} from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { GodRaysCombineShader } from 'three/addons/shaders/GodRaysCombineShader.js';
import { GodRaysGenerateShader } from 'three/addons/shaders/GodRaysGenerateShader.js';

/**
 * God Rays Pass
 *
 * Renders god rays based on a light source and an occlusion mask generated
 * from a separate scene containing black occluder objects.
 *
 * Workflow:
 * 1. Render occluderScene to renderTargetOcclusion (black objects on transparent background).
 * 2. Generate god rays based on light source position and renderTargetOcclusion, store in renderTargetGodRays.
 * 3. Blend the original scene (readBuffer) with renderTargetGodRays into the final buffer (writeBuffer or screen).
 */
class GodRaysPass extends Pass {

    constructor(lightSource, camera, scene, occluderScene, options = {}) {

        super();

        this.lightSource = lightSource;
        this.camera = camera;
        this.scene = scene;
        this.occluderScene = occluderScene;

        const {
            width = window.innerWidth,
            height = window.innerHeight,
            resolutionScale = 0.5,
            samples = 60,
            density = 0.96,
            decay = 0.93,
            weight = 0.6,
            exposure = 0.4,
            clampMax = 1.0,
            blur = false,
        } = options;

        this.needsSwap = true;

        const pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat };
        this.renderTargetOcclusion = new WebGLRenderTarget(width * resolutionScale, height * resolutionScale, pars);
        this.renderTargetGodRays = new WebGLRenderTarget(width * resolutionScale, height * resolutionScale, pars);

        this.occlusionMaterial = new MeshBasicMaterial({ color: 0x000000 });

        this.godRaysMaterial = this._createGodRaysGenerateMaterial({
            samples,
            density,
            decay,
            weight,
            exposure,
            clampMax,
            blur,
            resolutionScale
        });

        this.blendMaterial = this._createBlendMaterial();

        this.fsQuad = new FullScreenQuad(null);

        this.setSize(width, height);
    }

    dispose() {
        this.renderTargetOcclusion.dispose();
        this.renderTargetGodRays.dispose();
        this.godRaysMaterial.dispose();
        this.blendMaterial.dispose();
        if (this.occlusionMaterial) this.occlusionMaterial.dispose();
        this.fsQuad.dispose();
    }

    setSize(width, height) {
        const resScale = this.godRaysMaterial.uniforms.resolutionScale.value;
        this.renderTargetOcclusion.setSize(width * resScale, height * resScale);
        this.renderTargetGodRays.setSize(width * resScale, height * resScale);
    }

    render(renderer, writeBuffer, readBuffer) {

        const oldClearColor = new Color();
        renderer.getClearColor(oldClearColor);
        const oldClearAlpha = renderer.getClearAlpha();
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        renderer.setRenderTarget(this.renderTargetOcclusion);
        renderer.setClearColor(0x000000, 0.0);
        renderer.clear(true, true, false);

        const originalMaterials = new Map();
        this.occluderScene.traverse((node) => {
            if (node.isMesh) {
                originalMaterials.set(node, node.material);
                node.material = this.occlusionMaterial;
            }
        });

        renderer.render(this.occluderScene, this.camera);

        this.occluderScene.traverse((node) => {
            if (node.isMesh && originalMaterials.has(node)) {
                node.material = originalMaterials.get(node);
            }
        });
        originalMaterials.clear();

        const lightPos = new Vector3();
        const screenLightPos = new Vector2();
        lightPos.copy(this.lightSource.position);
        lightPos.project(this.camera);
        screenLightPos.x = (lightPos.x + 1) / 2;
        screenLightPos.y = (lightPos.y + 1) / 2;

        this.godRaysMaterial.uniforms.lightPosition.value.copy(screenLightPos);
        this.godRaysMaterial.uniforms.tOcclusion.value = this.renderTargetOcclusion.texture;

        this.fsQuad.material = this.godRaysMaterial;
        renderer.setRenderTarget(this.renderTargetGodRays);
        this.fsQuad.render(renderer);

        this.blendMaterial.uniforms.tColors.value = readBuffer.texture;
        this.blendMaterial.uniforms.tGodRays.value = this.renderTargetGodRays.texture;

        this.fsQuad.material = this.blendMaterial;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        this.fsQuad.render(renderer);

        renderer.setClearColor(oldClearColor, oldClearAlpha);
        renderer.autoClear = oldAutoClear;
        renderer.setRenderTarget(null);
    }

    _createGodRaysGenerateMaterial(options) {
        const { samples, density, decay, weight, exposure, clampMax, blur, resolutionScale } = options;

        const material = new ShaderMaterial({
            uniforms: UniformsUtils.clone(GodRaysGenerateShader.uniforms),
            vertexShader: GodRaysGenerateShader.vertexShader,
            fragmentShader: GodRaysGenerateShader.fragmentShader,
            defines: {
                'NUM_SAMPLES': samples.toFixed(0)
            }
        });

        material.uniforms.lightPosition.value = new Vector2(0.5, 0.5);
        material.uniforms.tOcclusion.value = null;
        material.uniforms.fDensity.value = density;
        material.uniforms.fDecay.value = decay;
        material.uniforms.fWeight.value = weight;
        material.uniforms.fExposure.value = exposure;
        material.uniforms.fClampMax.value = clampMax;
        material.uniforms.resolutionScale.value = resolutionScale;
        material.uniforms.blur.value = blur;

        return material;
    }

    _createBlendMaterial() {
        const material = new ShaderMaterial({
            uniforms: UniformsUtils.clone(GodRaysCombineShader.uniforms),
            vertexShader: GodRaysCombineShader.vertexShader,
            fragmentShader: GodRaysCombineShader.fragmentShader,
            blending: AdditiveBlending,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        material.uniforms.tColors.value = null;
        material.uniforms.tGodRays.value = null;
        material.uniforms.fIntensity.value = 1.0;

        return material;
    }
}

export { GodRaysPass };