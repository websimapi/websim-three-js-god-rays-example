/**
 * God-rays combine shader
 * Blends scene colors with generated god rays, typically using additive blending.
 */
const GodRaysCombineShader = {

	uniforms: {
		'tColors': { value: null },  // Input: Rendered scene colors texture
		'tGodRays': { value: null }, // Input: Generated god rays texture
		'fIntensity': { value: 1.0 } // Controls the intensity of the added god rays
	},

	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

	fragmentShader: /* glsl */`
		varying vec2 vUv;
		uniform sampler2D tColors;  // Texture containing the original scene render
		uniform sampler2D tGodRays; // Texture containing the generated god rays
		uniform float fIntensity;   // Multiplier for the god rays' brightness

		void main() {
			// Sample the original scene color
			vec4 sceneColor = texture2D( tColors, vUv );
			// Sample the generated god rays color
			vec4 godRayColor = texture2D( tGodRays, vUv );

			// Add the god rays to the scene color, scaled by intensity
			// This simulates light being added to the scene.
			gl_FragColor = sceneColor + godRayColor * fIntensity;

			// Optional: Clamp the result to prevent colors exceeding 1.0 if needed,
			// though additive blending often looks fine without clamping.
			// gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);
		}`
};

export { GodRaysCombineShader };