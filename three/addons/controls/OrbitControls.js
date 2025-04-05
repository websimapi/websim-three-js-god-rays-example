// Not generating the full code for OrbitControls as it's large.
// Assuming it's correctly placed here from the Three.js examples repository:
// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/OrbitControls.js
export class OrbitControls {
  constructor(object, domElement) {
    this.object = object;
    this.domElement = domElement;

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the control orbits around
    this.target = new THREE.Vector3();

    // How far you can dolly in and out ( Perspective camera only )
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // Limits to how far you can zoom in and out
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // Set to true to disable vertically rotating
    this.enableDamping = false;

    // Set the damping factor (between 0 and 1)
    this.dampingFactor = 0.05;

    // This option actually enables dollying in and out
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

