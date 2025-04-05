// Not generating the full code for Pass and FullScreenQuad as it's large.
// Assuming it's correctly placed here from the Three.js examples repository:
// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/Pass.js
export class Pass {
    constructor( scene, camera, overrideMaterial, fullscreenScene, fullscreenCamera ) {

        this.scene = scene;
        this.camera = camera;

        this.overrideMaterial = overrideMaterial;

        this.fullscreenScene = fullscreenScene;
        this.fullscreenCamera = fullscreenCamera;

        this.enabled = true;
        this.needsSwap = true;
        this.renderToScreen = false;

        this.fullscreenQuad = new FullScreenQuad();
    }

    setSize( width, height ) {

        this.fullscreenQuad.setSize( width, height );

    }

    render( renderer, writeBuffer, readBuffer, delta ) {

        if ( this.renderToScreen ) {

            renderer.state.buffers.stencil.setTest( false );

        }

        // TODO: Avoid using autoClear properties, and instead use the new scissor functionality

        renderer.state.buffers.color.setClear( this.scene.background, 0 );
        renderer.state.buffers.depth.setTest( false );
        renderer.state.buffers.depth.setClear( 1 );
        renderer.state.buffers.stencil.setClear( 0 );

        this.fullscreenQuad.material = this.overrideMaterial;

        if ( this.overrideMaterial ) {

            this.fullscreenQuad.material.uniforms[ 'tDiffuse