import { Vector2 } from 'three';

/**
 * God-rays generation shader
 * Samples along rays cast from the light source's screen position,
 * checking against an occlusion map texture (where black means occluded).
 * Accumulates light based on how much is *not* occluded along the ray path.
 */
const GodRaysGenerateShader = {

    // NUM_SAMPLES is provided via material defines in GodRaysPass.js
    // defines: { 'NUM_SAMPLES': 100 },

    uniforms: {
        // Input occlusion texture (black objects on transparent/non-black background)
        'tOcclusion': { value: null },
        // Light source position in screen space (coordinates from 0.0 to 1.0)
        'lightPosition': { value: new Vector2( 0.5, 0.5 ) },
        // --- Ray marching parameters ---
        // Controls how packed the samples are along the ray (higher = denser, shorter rays)
        'fDensity': { value: 0.96 },
        // Controls how quickly the light intensity falls off along the ray (0.9-0.99 are typical)
        'fDecay': { value: 0.93 },
        // Weighting factor for each sample's contribution to the final color
        'fWeight': { value: 0.6 },
        // --- Final color adjustments ---
        // Exposure multiplier for the accumulated ray color (overall brightness)
        'fExposure': { value: 0.4 },
        // Maximum allowed brightness value (prevents excessive bright spots)
        'fClampMax': { value: 1.0 },
        // --- Optional blur parameters (blur logic in shader is basic) ---
        'resolutionScale': { value: 0.5 }, // Resolution scale of the occlusion texture
        'blur': { value: false }            // Flag to enable/disable blur pass (not recommended unless improved)
    },

    vertexShader: /* glsl */`
        varying vec2 vUv; // Pass texture coordinates to fragment shader
        void main() {
            vUv = uv;
            // Standard vertex transformation for fullscreen quad
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,

    fragmentShader: /* glsl */`
        varying vec2 vUv; // Interpolated texture coordinate for this fragment

        // Uniforms received from the GodRaysPass
        uniform sampler2D tOcclusion;    // Occlusion texture (black = occluded)
        uniform vec2 lightPosition;      // Light position in screen space [0, 1]
        uniform float fDensity;
        uniform float fDecay;
        uniform float fWeight;
        uniform float fExposure;
        uniform float fClampMax;
        // uniform float resolutionScale; // For blur (unused currently)
        // uniform bool blur;            // For blur (unused currently)

        // NUM_SAMPLES is defined externally via material.defines

        void main() {
            // Calculate the direction vector from the fragment's UV to the light's screen position
            vec2 deltaTextCoord = vec2( vUv - lightPosition );
            // Calculate the step vector for ray marching
            // Divide by number of samples and scale by density
            vec2 textCoord = vUv;
            deltaTextCoord *= 1.0 / float( NUM_SAMPLES ) * fDensity;
            // Initial illumination factor (decays along the ray)
            float illuminationDecay = 1.0;
            // Accumulator for the final ray color (initialized to black)
            vec4 fragColor = vec4( 0.0 );

            // --- Ray Marching Loop ---
            // Sample along the ray from the current fragment towards the light source
            for ( int i = 0; i < NUM_SAMPLES; i ++ ) {
                // Step the texture coordinate towards the light source
                textCoord -= deltaTextCoord;

                // Sample the occlusion map at the current step
                // We assume the occlusion map stores occluders as black (0.0) in the R channel.
                // A value of 0.0 means fully occluded, 1.0 means fully transparent/no occlusion.
                // Note: If using RGBA render target cleared to (0,0,0,0), sampling 'a' might be better.
                // Here we sample 'r'.
                float occlusionSample = texture2D( tOcclusion, textCoord ).r;

                // Calculate how much light passes through at this step.
                // If occlusionSample is 0.0 (black), lightPassThrough is 1.0.
                // If occlusionSample is > 0.0 (not black), lightPassThrough is < 1.0.
                // This logic seems reversed based on the expectation that black occludes.
                // Let's correct: We want light where there ISN'T occlusion.
                // If the texture is black (0.0), there's an occluder, so light is 0.0.
                // If the texture is not black (e.g., 1.0 from clear color if not black), light is 1.0.
                // float lightPassThrough = occlusionSample; // If occluder is white on black bg
                float lightPassThrough = 1.0 - occlusionSample; // If occluder is black on white/transparent bg

                // Accumulate the light passing through, modulated by the current decay and weight
                fragColor += lightPassThrough * illuminationDecay * fWeight;

                // Apply decay for the next step (light gets weaker farther from fragment)
                illuminationDecay *= fDecay;
            }

            // --- Post-processing ---
            // Apply exposure to control overall brightness
            fragColor *= fExposure;
            // Clamp the final color to prevent overly bright areas
            fragColor = clamp( fragColor, 0.0, fClampMax );

            // Output the final calculated god ray color for this fragment
            gl_FragColor = fragColor;

            // Basic blur implementation (commented out - inefficient and often not desired)
            /*
            if (blur) {
                vec2 texelSize = 1.0 / textureSize(tOcclusion, 0); // Calculate texel size
                vec4 blurredColor = vec4(0.0);
                float count = 0.0;
                for (int x = -1; x <= 1; x++) {
                    for (int y = -1; y <= 1; y++) {
                        vec2 offset = vec2(float(x), float(y)) * texelSize;
                        // Re-calculate ray for neighbor pixel (VERY EXPENSIVE)
                        // ... (similar ray marching loop as above but for vUv + offset) ...
                        // blurredColor += neighborRayColor;
                        count += 1.0;
                    }
                }
                gl_FragColor = blurredColor / count;
            }
            */
        }`
};

export { GodRaysGenerateShader };