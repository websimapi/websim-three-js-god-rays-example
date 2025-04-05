/**
 * Copy Shader
 * @author alteredq / http://alteredqualia.com/
 */

const CopyShader = {

	uniforms: {

		'tDiffuse': { value: null },
		'opacity': { value: 1.0 }

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

			gl_FragColor = texture2D( tDiffuse, vUv );
			gl_FragColor.a *= opacity;


		}`

};

export { CopyShader };
`````` index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js God Rays Example</title>
    <style>
        body { margin: 0; overflow: hidden; background-color: #000; color: #fff; }
        canvas { display: block; }
        #info {
            position: absolute;
            top: 10px;
            width: 100%;
            text-align: center;
            z-index: 100;
            display:block;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div id="info">Three.js God Rays Example - Move camera with mouse</div>
    <script async src="https://unpkg.com/es-module-shims@1.6.3/dist/es-module-shims.js"></script>
    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.157.0/build/three.module.js",
                "three/addons/": "./three/addons/"
            }
        }
    </script>
    <script type="module" src="script.js"></script>
</body>
</html>

/**
 * Basic Copy Shader
 * Copies input texture to output.
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

