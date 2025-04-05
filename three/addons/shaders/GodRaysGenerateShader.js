import { Vector2 } from 'three';

/**
 * God-rays generation shader
 *
 * Similar to the implementation used by Crytek, derived from the GDC2007 presentation
 * by Martin Mittring.
 *
 * @author alteredq / http://alteredqualia.com/
 * @author mrdoob / http://mrdoob.com/
 */

const GodRaysGenerateShader = {

	defines: {
		'NUM_SAMPLES': 100
	},

	uniforms: {
		'tInput': { value: null },
		'fStepSize': { value: 1.0 },
		'vSunPositionScreenSpace': { value: new Vector2( 0.5, 0.5 ) }
	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		varying vec2 vUv;

		uniform sampler2D tInput; // Occlusion map

		uniform vec2 vSunPositionScreenSpace; // Screen space sun position (0.0..1.0)

		uniform float fStepSize; // Multiplier for step size (1.0 is regular)
		uniform float fDensity; // These are now passed via GodRaysPass options
		uniform float fDecay;
		uniform float fWeight;
		uniform float fExposure;
		uniform float fClampMax;


		const int NUM_SAMPLES = 100; // Should match defines

		void main() {

			// Calculate vectors from current fragment to screen space light position.

			vec2 delta = vSunPositionScreenSpace - vUv;
			float dist = length( delta );

			// Divide by number of samples and scale by control density parameter.

			vec2 step = delta / float( NUM_SAMPLES ) * fDensity; // Use fDensity here

			float illuminationDecay = 1.0;

			// Evaluate summation from Equation 3 NUM_SAMPLES iterations.

			vec4 color = vec4( 0.0 );

			// Step sample location along ray.

			vec2 currentUv = vUv;

			for ( int i = 0; i < NUM_SAMPLES; i ++ ) {

				// Determine sample location.

				currentUv += step;

				// Read from input texture.

				float occlusion = texture2D( tInput, currentUv ).r; // Read occlusion from R channel

				// Apply positional decay term.

				// Apply artifact reduction term.

				// Accumulate results.

				color += occlusion * illuminationDecay * fWeight; // Use fWeight

				// Update illumination decay term.

				illuminationDecay *= fDecay; // Use fDecay

			}

			// Apply exposure and clamp modification.

			gl_FragColor = color * fExposure; // Use fExposure
			gl_FragColor = clamp( gl_FragColor, 0.0, fClampMax ); // Use fClampMax

		}`

};

export { GodRaysGenerateShader };

import { Vector2 } from 'three';

/**
 * God-rays generation shader
 * Samples along rays from the light source, checking an occlusion map.
 */
const GodRaysGenerateShader = {

	// Define NUM_SAMPLES will be passed via material.defines in GodRayPass
	// defines: {
	// 	'NUM_SAMPLES': 100 // Default, overridden by pass options
	// },

	uniforms: {
		// Input occlusion texture (black objects, transparent/white elsewhere)
		'tOcclusion': { value: null },
		// Light source position in screen space (0..1)
		'lightPosition': { value: new Vector2( 0.5, 0.5 ) },
		// Controls for the god ray effect
		'fDensity': { value: 0.96 }, // How close samples are packed
		'fDecay': { value: 0.93 },   // How quickly intensity falls off with distance
		'fWeight': { value: 0.6 },    // Contribution of each sample
		'fExposure': { value: 0.4 },  // Final brightness multiplier
		'fClampMax': { value: 1.0 },  // Maximum brightness clamp
		// For optional blur (not fully implemented/optimized here)
		'resolutionScale': { value: 0.5 },
		'blur': { value: false }
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
		// NUM_SAMPLES defined externally

		void main() {
			vec2 deltaTextCoord = vec2( vUv - lightPosition );
			vec2 textCoord = vUv;
			// Scale step size based on density and number of samples
			deltaTextCoord *= 1.0 / float( NUM_SAMPLES ) * fDensity;
			float illuminationDecay = 1.0;
			vec4 fragColor = vec4( 0.0 ); // Accumulator

			// Sample along the ray
			for ( int i = 0; i < NUM_SAMPLES; i ++ ) {
				textCoord -= deltaTextCoord; // Step towards the light source
				// Sample occlusion map (assuming black = occluded, in R channel)
				// Texture stores occluders as black (0.0) on transparent (0.0) background.
				// We want light where there's NO occlusion, so sample should be 0.0? No, wait.
				// Occluder scene renders black meshes on transparent bg.
				// We want rays where the texture is TRANSPARENT (alpha=0 or color=black?).
				// Let's assume black means occluded, so we sample the color (r channel).
				float occlusionSample = texture2D( tOcclusion, textCoord ).r;

                // Correct logic: We want light where there ISN'T occlusion.
                // If black (0.0) means occluded, then (1.0 - occlusionSample) is the light passing through.
                float lightPassThrough = 1.0 - occlusionSample;

				// Accumulate light, weighted and decayed
				fragColor += lightPassThrough * illuminationDecay * fWeight;

				// Decay for next sample
				illuminationDecay *= fDecay;
			}

			// Apply exposure and clamp
			fragColor *= fExposure;
			fragColor = clamp( fragColor, 0.0, fClampMax );

			gl_FragColor = fragColor;
		}`
};

export { GodRaysGenerateShader };

