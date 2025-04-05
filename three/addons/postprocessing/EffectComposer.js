// Not generating the full code for EffectComposer as it's large.
// Assuming it's correctly placed here from the Three.js examples repository:
// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/EffectComposer.js
import * as THREE from 'three'; 
import { Pass } from './Pass.js'; 
import { CopyShader } from 'three/addons/shaders/CopyShader.js'; 
import { ShaderPass } from './ShaderPass.js'; 

class EffectComposer {
  constructor(renderer, renderTarget) {
    this.renderer = renderer;

    if (renderTarget === undefined) {
      const { width, height } = renderer.getSize( new THREE.Vector2() ); 
      const parameters = {
        minFilter: THREE.LinearFilter, 
        magFilter: THREE.LinearFilter, 
        format: THREE.RGBAFormat, 
      };
      this.renderTarget1 = new THREE.WebGLRenderTarget( 
        width,
        height,
        parameters
      );
      this.renderTarget2 = this.renderTarget1.clone(); 
    } else {
      this.renderTarget1 = renderTarget;
      this.renderTarget2 = renderTarget.clone();
    }

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;

    this.passes = [];

    if ( ShaderPass !== undefined && CopyShader !== undefined ) {
         this.copyPass = new ShaderPass( CopyShader ); 
    } else {
         console.warn( 'EffectComposer relies on ShaderPass and CopyShader.' );
         this.copyPass = null; 
    }

    this.clock = new THREE.Clock(); 
  }

  addPass( pass ) {
    this.passes.push( pass );
    const { width, height } = this.renderer.getSize( new THREE.Vector2() );
		pass.setSize( width, height );
  }

  insertPass( pass, index ) {
    this.passes.splice( index, 0, pass );
    const { width, height } = this.renderer.getSize( new THREE.Vector2() );
		pass.setSize( width, height );
  }

  removePass( pass ) {
		const index = this.passes.indexOf( pass );
		if ( index !== - 1 ) {
			this.passes.splice( index, 1 );
		}
	}

  isLastEnabledPass( passIndex ) {
		for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {
			if ( this.passes[ i ].enabled ) {
				return false;
			}
		}
		return true;
	}

  render( deltaTime ) {
    const currentRenderTarget = this.renderer.getRenderTarget(); 
    let maskActive = false;

    for ( let i = 0, il = this.passes.length; i < il; i ++ ) {
      const pass = this.passes[ i ];
      if ( pass.enabled === false ) continue;

      pass.renderToScreen = ( this.renderToScreen && this.isLastEnabledPass( i ) );
      pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

      if ( pass.needsSwap ) {
        if ( maskActive ) { 
        }
        this.swapBuffers();
      }

    }

    this.renderer.setRenderTarget( currentRenderTarget ); 
  }

  reset( renderTarget ) {
    if ( renderTarget === undefined ) {
        const { width, height } = this.renderer.getSize( new THREE.Vector2() );
        renderTarget = this.renderTarget1.clone();
        renderTarget.setSize( width, height );
    }

    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }

  setSize( width, height ) {
    this.renderTarget1.setSize( width, height );
    this.renderTarget2.setSize( width, height );

    for ( let i = 0; i < this.passes.length; i ++ ) {
        this.passes[ i ].setSize( width, height );
    }
  }

  setPixelRatio( pixelRatio ) {
		this.renderer.setPixelRatio( pixelRatio ); 
	}

  swapBuffers() {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }

  dispose() {
		this.renderTarget1.dispose();
		this.renderTarget2.dispose();
		if (this.copyPass && this.copyPass.dispose) this.copyPass.dispose(); 
        for ( let i = 0, il = this.passes.length; i < il; i ++ ) {
            if (this.passes[i].dispose) this.passes[i].dispose(); 
        }
	}
} 