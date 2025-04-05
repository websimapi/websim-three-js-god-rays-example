/**
 * Basic Copy Shader
 * Copies input texture to output, optionally multiplying by opacity.
 */
const CopyShader = {

	uniforms: {
		'tDiffuse': { value: null }, // Input texture
		'opacity': { value: 1.0 }    // Opacity multiplier
	},

	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

	fragmentShader: /* glsl */`
		uniform float opacity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;
		}`
};

export { CopyShader };