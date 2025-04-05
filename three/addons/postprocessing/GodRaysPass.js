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
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { GodRaysCombineShader } from 'three/addons/shaders/GodRaysCombineShader.js';
import { GodRaysGenerateShader } from 'three/addons/shaders/GodRaysGenerateShader.js';

/**
 * God Rays Pass
 * Based on Nvidia Demo Code & GPU Gems 3 Chapter 13
 * http://http.developer.nvidia.com/GPUGems3/gpugems3_ch13.html
 */
class GodRaysPass extends Pass {

    constructor(lightSource, camera, occluderScene, options = {}) { 

        super();

        this.lightSource = lightSource; 
        this.camera = camera;
        this.occluderScene = occluderScene; 

        const {
            resolutionScale = 0.5,
            samples = 60,
            density = 0.96,
            decay = 0.93,
            weight = 0.4, 
            exposure = 0.55, 
            clampMax = 1.0,
        } = options;

        const pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat };
        this.renderTargetOcclusion = new WebGLRenderTarget( 1, 1, pars ); 
        this.renderTargetGodRays = new WebGLRenderTarget( 1, 1, pars ); 


        this.godRaysMaterial = this._createGodRaysGenerateMaterial({
            samples,
            density,
            decay,
            weight,
            exposure,
            clampMax,
            resolutionScale 
        });

        this.blendMaterial = this._createBlendMaterial();

        if ( typeof FullScreenQuad === 'undefined' ) {
             console.error( "GodRaysPass requires FullScreenQuad. Ensure it's defined, possibly within Pass.js." );
             try {
                 const THREE = await import('three'); 
                  class BasicFullScreenQuad {
                     constructor( material ) { this._mesh = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), material ); this._camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 ); }
                     dispose() { this._mesh.geometry.dispose(); }
                     render( renderer ) { renderer.render( this._mesh, this._camera ); }
                     get material() { return this._mesh.material; }
                     set material( value ) { this._mesh.material = value; }
                 }
                 this.fsQuad = new BasicFullScreenQuad(null);
             } catch(e) {
                 console.error("Failed to create fallback FullScreenQuad", e);
                 this.fsQuad = { render: () => {}, dispose: () => {}, set material(v){} }; 
             }

        } else {
             this.fsQuad = new FullScreenQuad(null);
        }


        this.needsSwap = false; 
        this.renderToScreen = false; 
    }

    dispose() {
        this.renderTargetOcclusion.dispose();
        this.renderTargetGodRays.dispose();
        this.godRaysMaterial.dispose();
        this.blendMaterial.dispose();
        this.fsQuad.dispose();
    }

    setSize(width, height) {
        const resScale = this.godRaysMaterial.uniforms.resolutionScale.value;
        this.renderTargetOcclusion.setSize(width * resScale, height * resScale);
        this.renderTargetGodRays.setSize(width * resScale, height * resScale);
    }

    render(renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

        const oldClearColor = new Color();
        renderer.getClearColor(oldClearColor);
        const oldClearAlpha = renderer.getClearAlpha();
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false; 


        renderer.setRenderTarget(this.renderTargetOcclusion);
        renderer.setClearColor(0x000000, 0.0);
        renderer.clear(true, true, false); 
        renderer.render(this.occluderScene, this.camera);


        const lightPos = new Vector3();
        const screenLightPos = new Vector2();

        this.lightSource.updateMatrixWorld();
        lightPos.setFromMatrixPosition(this.lightSource.matrixWorld); 

        lightPos.project(this.camera); 

        screenLightPos.x = (lightPos.x + 1) * 0.5; 
        screenLightPos.y = (lightPos.y + 1) * 0.5; 

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
        const { samples, density, decay, weight, exposure, clampMax, resolutionScale } = options;

        const material = new ShaderMaterial({
            uniforms: UniformsUtils.clone(GodRaysGenerateShader.uniforms),
            vertexShader: GodRaysGenerateShader.vertexShader,
            fragmentShader: GodRaysGenerateShader.fragmentShader,
            defines: {
                'NUM_SAMPLES': samples 
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