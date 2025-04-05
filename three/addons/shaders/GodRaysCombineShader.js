import { Vector2 } from 'three';

/**
 * God-rays combine shader
 *
 * Blends god-rays with screen content.
 * @author alteredq / http://alteredqualia.com/
 */

const GodRaysCombineShader = {

	uniforms: {

		'tColors': { value: null },
		'tGodRays': { value: null },
		'fIntensity': {	value: 1.0 }

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

			// Sample the color buffers and combine
			// Usually, ADDITIVE blending is used.

			gl_FragColor = texture2D( tColors, vUv ) + texture2D( tGodRays, vUv ) * fIntensity;


		}`

};

export { GodRaysCombineShader };

/**
 * God-rays combine shader
 * Blends scene colors with generated god rays.
 */
const GodRaysCombineShader = {

	uniforms: {
		'tColors': { value: null },  // Input: Rendered scene colors
		'tGodRays': { value: null }, // Input: Generated god rays texture
		'fIntensity': { value: 1.0 } // Controls the intensity of the god rays added
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
			// Additive blending: Add god rays to the original scene color
			vec4 sceneColor = texture2D( tColors, vUv );
			vec4 godRayColor = texture2D( tGodRays, vUv );
			gl_FragColor = sceneColor + godRayColor * fIntensity;
			// Clamp to avoid over-brightening if needed, though additive usually handles this.
			// gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);
		}`
};

export { GodRaysCombineShader };

