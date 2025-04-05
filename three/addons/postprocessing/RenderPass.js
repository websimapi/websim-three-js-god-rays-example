import * as THREE from 'three';
import { Pass } from './Pass.js';

export class RenderPass extends Pass {
    constructor( scene, camera, overrideMaterial, overrideDepthMaterial ) {
        super();

        this.scene = scene;
        this.camera = camera;

        this.overrideMaterial = overrideMaterial;
        this.overrideDepthMaterial = overrideDepthMaterial;

        this.oldClearColor = new THREE.Color();
        this.oldClearAlpha = 0;

        this.enabled = true;
        this.clear = true;
        this.needsSwap = false; // Note: needsSwap should be false by default for RenderPass

    }

    render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        let oldClearColor, oldClearAlpha, oldOverrideMaterial; // Declare variables

        if ( this.overrideMaterial !== undefined ) {

            oldOverrideMaterial = this.scene.overrideMaterial;

            this.scene.overrideMaterial = this.overrideMaterial;

        }

        if ( this.clearColor ) { // Check if clearColor is set

            renderer.getClearColor( this.oldClearColor ); // Use instance property
            oldClearAlpha = renderer.getClearAlpha();

            renderer.setClearColor( this.clearColor, this.clearAlpha );

        }

        if ( this.clearDepth ) { // Check if clearDepth is set

            renderer.clearDepth();

        }


        // Render
        renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );

        if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
        renderer.render( this.scene, this.camera );


        // Restore original state
        if ( this.clearColor ) {

            renderer.setClearColor( this.oldClearColor, oldClearAlpha );

        }


        if ( this.overrideMaterial !== undefined ) {

            this.scene.overrideMaterial = oldOverrideMaterial;

        }


        renderer.autoClear = oldAutoClear;


    } // End render method - ensure closing bracket exists

    setSize( width, height ) {

    }

    dispose() {

    }

} // End class definition - ensure closing bracket exists