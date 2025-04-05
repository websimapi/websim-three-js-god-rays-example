import {
	AdditiveBlending,
	BufferGeometry,
	Color,
	FileLoader,
	Float32BufferAttribute,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	RGBAFormat,
	Scene,
	ShaderMaterial,
	UniformsUtils,
	Vector2,
	Vector3,
	WebGLRenderTarget
} from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { GodRaysCombineShader } from 'three/addons/shaders/GodRaysCombineShader.js';
import { GodRaysGenerateShader } from 'three/addons/shaders/GodRaysGenerateShader.js';

/**
 * The God-ray passes need input from a rendering pass that renders to a depth map.
 *
 * The general pipeline is as follows:
 *
 * Standard Rendering Pass:
 *      Render beauty pass to render target A. Creates color texture.
 * Depth Pass:
 *      Render depth pass to render target B. Creates depth texture.
 * God-rays Pass:
 *      Generate god-rays from depth texture and light source position. Store in render target C.
 * Composite Pass:
 *      Composites god-rays from render target C onto color texture from render target A. Store in render target D (or screen).
 *
 * The depth map can be generated from the depth texture of render target A, or rendered manually using a depth material.
 * See the example webgl_postprocessing_godrays.
 *
 * @author Stefano Corradi - http://www.stefanocorradi.com/
 * @author nvidia - https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch13.html
 * @author three.js - https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/GodRaysPass.js
 *
 * Ported to ESM by Don McCurdy
 */

/** Post-processing pass */
class GodRaysPass extends Pass {

	constructor( lightSource, camera, scene, occluderScene, options = {} ) {

		super();

		this.lightSource = lightSource;
        this.camera = camera; // Store camera reference
		this.scene = scene; // Store main scene
		this.occluderScene = occluderScene; // Store occluder scene

		const {
			// Screen resolution.
			width = 512, height = 512,
			// Resolution of the god rays generation pass.
			resolutionScale = 0.5,
			// Number of samples used in the god rays generation pass.
			samples = 60,
			// Density of the god rays.
			density = 0.96,
			// Decay of the god rays.
			decay = 0.93,
			// Weight of the god rays.
			weight = 0.6,
			// Exposure of the god rays.
			exposure = 0.4,
			// Clamp value for the god rays.
			clampMax = 1.0,
			// Blend mode.
			blendFunction = AdditiveBlending,
			// Enable blur.
			blur = false,
		} = options;

		this.needsSwap = false;

		// Render targets

		const pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat };
		this.renderTargetA = new WebGLRenderTarget( width, height, pars );
		this.renderTargetB = new WebGLRenderTarget( width, height, pars );
		this.renderTargetOcclusion = new WebGLRenderTarget( width * resolutionScale, height * resolutionScale, pars );
		this.renderTargetGodRays = new WebGLRenderTarget( width * resolutionScale, height * resolutionScale, pars );

		// Scene materials

		this.godRaysMaterial = this._createGodRaysMaterial( {
			samples, density, decay, weight, exposure, clampMax, blur,
		} );
		this.occlusionMaterial = new MeshBasicMaterial( { color: 0x000000 } );

		// Copy pass

		if ( CopyShader === undefined ) {

			throw new Error( 'THREE.GodRaysPass relies on CopyShader' );

		}

		const copyShader = CopyShader;
		this.copyUniforms = UniformsUtils.clone( copyShader.uniforms );
		this.copyMaterial = new ShaderMaterial( {
			uniforms: this.copyUniforms,
			vertexShader: copyShader.vertexShader,
			fragmentShader: copyShader.fragmentShader,
			depthTest: false,
			depthWrite: false,
			blending: AdditiveBlending, // Use AdditiveBlending for combining god rays
		} );

		// Composite pass

		this.blendMaterial = this._createBlendMaterial( { blendFunction } );

		// Setup fullscreen quad

		this.fsQuad = new FullScreenQuad( null ); // Material assigned in render loop.

	}

	dispose() {

		this.renderTargetA.dispose();
		this.renderTargetB.dispose();
		this.renderTargetOcclusion.dispose();
		this.renderTargetGodRays.dispose();

		this.godRaysMaterial.dispose();
		this.blendMaterial.dispose();
		this.copyMaterial.dispose();
		this.occlusionMaterial.dispose();

		this.fsQuad.dispose();

	}

	setSize( width, height ) {

		this.renderTargetA.setSize( width, height );
		this.renderTargetB.setSize( width, height );

		const resScale = this.godRaysMaterial.uniforms.resolutionScale.value;
		this.renderTargetOcclusion.setSize( width * resScale, height * resScale );
		this.renderTargetGodRays.setSize( width * resScale, height * resScale );

	}

	render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

		const oldClearColor = new Color();
		const oldClearAlpha = renderer.getClearAlpha();
		const oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;
		renderer.getClearColor( oldClearColor );

		// Render occluders to occlusion buffer
        renderer.setRenderTarget(this.renderTargetOcclusion);
        renderer.setClearColor(0x000000, 0.0); // Clear with black, fully transparent
        renderer.clear(true, true, false); // Clear color and depth

        // Save original materials
        const originalMaterials = new Map();
        this.occluderScene.traverse((node) => {
            if (node.isMesh) {
                originalMaterials.set(node, node.material);
                node.material = this.occlusionMaterial;
            }
        });

        renderer.render(this.occluderScene, this.camera);

        // Restore original materials
        this.occluderScene.traverse((node) => {
            if (node.isMesh && originalMaterials.has(node)) {
                node.material = originalMaterials.get(node);
            }
        });


		// Generate god rays
		const lightPos = new Vector3();
		const screenLightPos = new Vector2();

		lightPos.copy( this.lightSource.position );
		lightPos.project( this.camera );

		screenLightPos.x = ( lightPos.x + 1 ) / 2;
		screenLightPos.y = ( lightPos.y + 1 ) / 2;

		this.godRaysMaterial.uniforms.lightPosition.value.copy( screenLightPos );
		this.godRaysMaterial.uniforms.tOcclusion.value = this.renderTargetOcclusion.texture;

		this.fsQuad.material = this.godRaysMaterial;
		renderer.setRenderTarget( this.renderTargetGodRays );
		renderer.clear( true, true, false );
		this.fsQuad.render( renderer );

		// Blend god rays with the scene
		this.blendMaterial.uniforms.tColors.value = readBuffer.texture;
		this.blendMaterial.uniforms.tGodRays.value = this.renderTargetGodRays.texture;
		this.fsQuad.material = this.blendMaterial;

		renderer.setRenderTarget( this.renderToScreen ? null : writeBuffer );
		// renderer.clear( true, true, false ); // Don't clear the target buffer
		this.fsQuad.render( renderer );

		// Restore renderer settings
		renderer.setClearColor( oldClearColor, oldClearAlpha );
		renderer.autoClear = oldAutoClear;

	}

	_createGodRaysMaterial( options ) {

		const {
			samples, density, decay, weight, exposure, clampMax, blur, resolutionScale = 0.5,
		} = options;

		if ( GodRaysGenerateShader === undefined ) {

			throw new Error( 'THREE.GodRaysPass relies on GodRaysGenerateShader' );

		}

		const godRaysGenShader = GodRaysGenerateShader;
		const godraysCombineShader = GodRaysCombineShader; // We actually use Combine here now


		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( godraysCombineShader.uniforms ), // Use combine shader uniforms
			vertexShader: godraysCombineShader.vertexShader,
			fragmentShader: godraysCombineShader.fragmentShader,
			defines: {
				// Pass options to shader via defines.
				NUM_SAMPLES: samples,
			}
		} );

        // Adapt uniforms from GodRaysGenerateShader that are used by GodRaysCombineShader
        material.uniforms.fDensity.value = density;
        material.uniforms.fDecay.value = decay;
        material.uniforms.fWeight.value = weight;
        material.uniforms.fExposure.value = exposure;
        material.uniforms.fClampMax.value = clampMax;
        material.uniforms.vSunPositionScreenSpace.value = new Vector2(0.5, 0.5); // Placeholder, updated in render
        material.uniforms.tInput.value = null; // tOcclusion in the new structure


		// Uniforms specific to the GodRaysCombineShader structure (originally from GodRaysGenerate)
        material.uniforms.lightPosition = { value: new Vector2(0.5, 0.5) }; // Renamed from vSunPositionScreenSpace
		material.uniforms.resolutionScale = { value: resolutionScale }; // Need to pass resolution scale if blur is enabled
		material.uniforms.blur = { value: blur };

        // Rename tInput to tOcclusion to match the shader expected input
        material.uniforms.tOcclusion = { value: null }; // Will be set in render()

        // Remove uniforms not present in GodRaysCombineShader
        delete material.uniforms.vSunPositionScreenSpace;
        delete material.uniforms.tInput;


		return material;

	}

	_createBlendMaterial( options ) {

		const { blendFunction } = options;

		if ( GodRaysCombineShader === undefined ) {

			throw new Error( 'THREE.GodRaysPass relies on GodRaysCombineShader' );

		}

		const godraysCombineShader = GodRaysCombineShader;

		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( godraysCombineShader.uniforms ),
			vertexShader: godraysCombineShader.vertexShader,
			fragmentShader: godraysCombineShader.fragmentShader,
			blending: blendFunction, // Use AdditiveBlending for combining
            transparent: true, // Enable transparency
			depthTest: false,
			depthWrite: false,
		} );

        // Rename uniforms to match GodRaysCombineShader's expectations for blending
        material.uniforms.tColors = { value: null }; // Original scene colors
        material.uniforms.tGodRays = { value: null }; // Generated god rays texture

        // Set default values or remove unused ones from the original GodRaysCombineShader uniforms
        // Keep only tColors and tGodRays for the blending stage
        const blendUniforms = {
            tColors: material.uniforms.tColors,
            tGodRays: material.uniforms.tGodRays,
        };
        material.uniforms = blendUniforms;


		return material;

	}

}

// Shaders definitions (need to be included if not using built-in)

const GodRaysCombineShader = {

	uniforms: {

		tColors: { value: null },
		tGodRays: { value: null },
		fIntensity: {	value: 1.0 }

	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		varying vec2 vUv;

		uniform sampler2D tColors;
		uniform sampler2D tGodRays;
		uniform float fIntensity;

		void main() {

			// Load the original scene color and the god rays color.
			vec4 sceneColor = texture2D( tColors, vUv );
			vec4 godRayColor = texture2D( tGodRays, vUv );

			// Blend the two colors. Usually AdditiveBlending works best.
			gl_FragColor = sceneColor + godRayColor * fIntensity;
            //gl_FragColor = vec4(godRayColor.rgb, 1.0); // Debug: Show only god rays


		}`

};


// Simplified GodRaysGenerateShader for occlusion mask + rays generation
const GodRaysGenerateShader = {

	uniforms: {
		tOcclusion: { value: null },
		lightPosition: { value: new Vector2( 0.5, 0.5 ) }, // Screen space light position
		fDensity: { value: 0.96 },
		fDecay: { value: 0.93 },
		fWeight: { value: 0.6 },
		fExposure: { value: 0.4 },
		fClampMax: { value: 1.0 },
		resolutionScale: { value: 0.5 },
		blur: { value: false } // Optional blur flag
	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		varying vec2 vUv;

		uniform sampler2D tOcclusion;
		uniform vec2 lightPosition;
		uniform float fDensity;
		uniform float fDecay;
		uniform float fWeight;
		uniform float fExposure;
		uniform float fClampMax;
		uniform float resolutionScale; // Use this if blur is enabled
		uniform bool blur;

		const int NUM_SAMPLES = 100; // Default samples, can be overridden by defines

		void main() {

			vec2 deltaTextCoord = vec2( vUv - lightPosition );
			vec2 textCoord = vUv;
			deltaTextCoord *= 1.0 / float( NUM_SAMPLES ) * fDensity;
			float illuminationDecay = 1.0;
			vec4 fragColor = vec4( 0.0 );

			// Sample along the ray from the light source
			for ( int i = 0; i < NUM_SAMPLES; i ++ ) {
                textCoord -= deltaTextCoord;
				float occlusion = texture2D( tOcclusion, textCoord ).r; // Occlusion mask is in the red channel
				fragColor += occlusion * illuminationDecay * fWeight;
				illuminationDecay *= fDecay;
			}

            fragColor *= fExposure;
			fragColor = clamp( fragColor, 0.0, fClampMax );

            // Optional blur for smoother rays (simple box blur)
            if (blur) {
                vec2 texelSize = 1.0 / (textureSize(tOcclusion, 0) * resolutionScale); // Adjusted texel size
                vec4 blurredColor = vec4(0.0);
                for (int x = -1; x <= 1; x++) {
                    for (int y = -1; y <= 1; y++) {
                         vec2 offset = vec2(float(x), float(y)) * texelSize;
                         // Recalculate rays for neighboring pixels (this is intensive)
                        vec2 neighborUv = vUv + offset;
                        vec2 neighborDelta = vec2( neighborUv - lightPosition );
                        neighborDelta *= 1.0 / float( NUM_SAMPLES ) * fDensity;
                        float neighborIllumDecay = 1.0;
                        vec4 neighborFragColor = vec4(0.0);
                        vec2 neighborTextCoord = neighborUv;
                        for ( int j = 0; j < NUM_SAMPLES; j ++ ) {
                             neighborTextCoord -= neighborDelta;
                             float neighborOcclusion = texture2D( tOcclusion, neighborTextCoord ).r;
                             neighborFragColor += neighborOcclusion * neighborIllumDecay * fWeight;
                             neighborIllumDecay *= fDecay;
                        }
                        neighborFragColor *= fExposure;
			            neighborFragColor = clamp( neighborFragColor, 0.0, fClampMax );
                        blurredColor += neighborFragColor;

                    }
                }
                fragColor = blurredColor / 9.0; // Average the samples
            }


			gl_FragColor = fragColor;

		}`
};


export { GodRaysCombineShader, GodRaysGenerateShader, GodRaysPass };
// Export Effect separately if needed elsewhere, though GodRaysPass includes its functionality
// export { GodRaysEffect }; // GodRaysEffect is integrated into GodRaysPass now

import {
	AdditiveBlending,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
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
 * Renders god rays based on a light source and an occlusion mask.
 * This version requires an explicit occlusion scene pass.
 *
 * Workflow:
 * 1. Render occluderScene to renderTargetOcclusion (black objects on transparent background).
 * 2. Generate god rays based on light source position and renderTargetOcclusion, store in renderTargetGodRays.
 * 3. Blend the original scene (readBuffer) with renderTargetGodRays into the final buffer (writeBuffer or screen).
 */
class GodRaysPass extends Pass {

	constructor( lightSource, camera, scene, occluderScene, options = {} ) {

		super();

		this.lightSource = lightSource;
		this.camera = camera;
		this.scene = scene; // Keep reference, might be useful for depth checks later
		this.occluderScene = occluderScene;

		const {
			width = window.innerWidth, height = window.innerHeight,
			resolutionScale = 0.5,
			samples = 60,
			density = 0.96,
			decay = 0.93,
			weight = 0.6,
			exposure = 0.4,
			clampMax = 1.0,
			blur = false, // Note: Blur implementation in the provided shader is basic/potentially slow
		} = options;

		this.needsSwap = true; // Needs to write to a new buffer after combining

		// Render targets
		const pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat };
		this.renderTargetOcclusion = new WebGLRenderTarget( width * resolutionScale, height * resolutionScale, pars );
		this.renderTargetGodRays = new WebGLRenderTarget( width * resolutionScale, height * resolutionScale, pars );

		// Internal materials
		this.occlusionMaterial = new MeshBasicMaterial( { color: 0x000000 } ); // Used if not overridden by occluderScene

		// God Rays Generation Material
		this.godRaysMaterial = this._createGodRaysGenerateMaterial( {
			samples, density, decay, weight, exposure, clampMax, blur, resolutionScale
		} );

		// Compositing Material (Blending)
		this.blendMaterial = this._createBlendMaterial();

		// Fullscreen Quad
		this.fsQuad = new FullScreenQuad( null ); // Material assigned dynamically

		// Initial size setup
		this.setSize( width, height );
	}

	dispose() {
		this.renderTargetOcclusion.dispose();
		this.renderTargetGodRays.dispose();
		this.godRaysMaterial.dispose();
		this.blendMaterial.dispose();
		this.fsQuad.dispose();
	}

	setSize( width, height ) {
		const resScale = this.godRaysMaterial.uniforms.resolutionScale.value;
		this.renderTargetOcclusion.setSize( width * resScale, height * resScale );
		this.renderTargetGodRays.setSize( width * resScale, height * resScale );
	}

	render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

		const oldClearColor = new Color();
		renderer.getClearColor( oldClearColor );
		const oldClearAlpha = renderer.getClearAlpha();
		const oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		// 1. Render Occlusion Mask
		// ------------------------
		renderer.setRenderTarget( this.renderTargetOcclusion );
		renderer.setClearColor( 0x000000, 0.0 ); // Clear to black, fully transparent
		renderer.clear( true, true, false );

		// Temporarily replace materials in occluderScene with black
		const originalMaterials = new Map();
        this.occluderScene.traverse( ( node ) => {
            if ( node.isMesh ) {
                originalMaterials.set( node, node.material );
                node.material = this.occlusionMaterial;
            }
        });

		renderer.render( this.occluderScene, this.camera );

		// Restore original materials
        this.occluderScene.traverse( ( node ) => {
            if ( node.isMesh && originalMaterials.has( node ) ) {
                node.material = originalMaterials.get( node );
            }
        });
		originalMaterials.clear(); // Clear the map


		// 2. Generate God Rays
		// -------------------
		const lightPos = new Vector3();
		const screenLightPos = new Vector2();

		// Project light source position to screen space (-1 to 1)
		lightPos.copy( this.lightSource.position );
		lightPos.project( this.camera );

		// Convert screen space to texture space (0 to 1)
		screenLightPos.x = ( lightPos.x + 1 ) / 2;
		screenLightPos.y = ( lightPos.y + 1 ) / 2;

		// Update uniforms
		this.godRaysMaterial.uniforms.lightPosition.value.copy( screenLightPos );
		this.godRaysMaterial.uniforms.tOcclusion.value = this.renderTargetOcclusion.texture;

		// Render god rays generation pass
		this.fsQuad.material = this.godRaysMaterial;
		renderer.setRenderTarget( this.renderTargetGodRays );
		// Don't need to clear if rendering fullscreen quad, it overwrites anyway
		// renderer.clear(true, true, false); // Keep existing clear color/alpha
		this.fsQuad.render( renderer );


		// 3. Blend Scene and God Rays
		// ---------------------------
		this.blendMaterial.uniforms.tColors.value = readBuffer.texture;
		this.blendMaterial.uniforms.tGodRays.value = this.renderTargetGodRays.texture;

		this.fsQuad.material = this.blendMaterial;
		renderer.setRenderTarget( this.renderToScreen ? null : writeBuffer );
		// Don't clear the target buffer, we are blending onto it
		this.fsQuad.render( renderer );


		// Restore renderer state
		renderer.setClearColor( oldClearColor, oldClearAlpha );
		renderer.autoClear = oldAutoClear;

	}

	// --- Material Creation ---

	_createGodRaysGenerateMaterial( options ) {
		const { samples, density, decay, weight, exposure, clampMax, blur, resolutionScale } = options;

		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( GodRaysGenerateShader.uniforms ),
			vertexShader: GodRaysGenerateShader.vertexShader,
			fragmentShader: GodRaysGenerateShader.fragmentShader,
			defines: {
				NUM_SAMPLES: samples
			}
		} );

		// Map options to uniforms
		material.uniforms.lightPosition.value = new Vector2( 0.5, 0.5 ); // Placeholder
		material.uniforms.tOcclusion.value = null; // Set in render loop
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
		const material = new ShaderMaterial( {
			uniforms: UniformsUtils.clone( GodRaysCombineShader.uniforms ),
			vertexShader: GodRaysCombineShader.vertexShader,
			fragmentShader: GodRaysCombineShader.fragmentShader,
			blending: AdditiveBlending, // Common choice for light rays
			transparent: true,
			depthTest: false,
			depthWrite: false,
		} );

		material.uniforms.tColors.value = null; // Set in render loop
		material.uniforms.tGodRays.value = null; // Set in render loop
        material.uniforms.fIntensity.value = 1.0; // Controls blend intensity (can be adjusted)

		return material;
	}
}


export { GodRaysPass };

