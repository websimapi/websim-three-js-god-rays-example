// Not generating the full code for EffectComposer as it's large.
// Assuming it's correctly placed here from the Three.js examples repository:
// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/EffectComposer.js
import {
  Pass,
  ShaderPass,
  MaskPass,
  ClearMaskPass,
  CopyPass,
} from './passes';

class EffectComposer {
  constructor(renderer, renderTarget) {
    this.renderer = renderer;

    if (renderTarget === undefined) {
      const parameters = {
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        format: RGBAFormat,
        stencilBuffer: true,
      };
      this.renderTarget1 = new WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        parameters
      );
      this.renderTarget2 = new WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        parameters
      );
    } else {
      this.renderTarget1 = renderTarget;
      this.renderTarget2 = renderTarget.clone();
    }

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;

    this.passes = [];

    if (CopyPass !== undefined) {
      this.copyPass = new CopyPass