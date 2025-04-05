import { Pass } from './Pass.js';

export class RenderPass extends Pass {
    constructor( scene, camera, overrideMaterial, overrideDepthMaterial ) {
        super();

        this.scene = scene;
        this.camera = camera;

        this.overrideMaterial = overrideMaterial;
        this.overrideDepthMaterial = overrideDepthMaterial;

        this.oldClearColor = new Float32Array( 4 );
        this.oldClearAlpha = 0;

        this.enabled = true;
        this.clear = true;
        this.needsSwap = true;

    }

    render( renderer, writeBuffer, readBuffer ) {

        if ( this.overrideMaterial ) {

            // Save original material
            const originalMaterials = {};
            this.scene.traverse( function ( object ) {
                if ( object.isMesh ) {
                    originalMaterials[ object.id ] = object.material;
                }
            } );

            // Set override material
            this.scene.traverse( function ( object ) {
                if ( object.isMesh && object.material !== undefined ) {
                    object.material = RenderPass.overrideMaterial;
                }
            } );

        }

        if ( this.overrideDepthMaterial ) {

            // Save original material
            const originalDepthMaterials = {};
            this.scene.traverse( function ( object ) {
                if ( object