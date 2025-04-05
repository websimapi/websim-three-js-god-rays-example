import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GodRaysEffect, GodRaysPass } from 'three/addons/postprocessing/GodRaysPass.js'; // Correct import path

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

camera.position.z = 20;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// God Rays Source Object (e.g., a bright sphere)
const sunGeometry = new THREE.SphereGeometry(1, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffddaa, emissive: 0xffddaa, emissiveIntensity: 1 });
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunMesh.position.set(0, 5, -10); // Position the sun
scene.add(sunMesh);

// Occluding Objects
const boxGeometry = new THREE.BoxGeometry(2, 10, 2);
const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

for (let i = 0; i < 10; i++) {
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    boxMesh.position.x = (Math.random() - 0.5) * 20;
    boxMesh.position.y = (Math.random() - 0.5) * 5;
    boxMesh.position.z = (Math.random() - 0.5) * 10 - 5;
    boxMesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(boxMesh);
}

// Post-processing setup
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// God Rays Pass
// The GodRaysPass requires a specific rendering setup:
// 1. Render the scene normally.
// 2. Render the occluding objects in black to a separate render target (mask target).
// 3. Apply the God Rays effect using the sun position and the mask target.

// Create a separate scene for occluders
const occluderScene = new THREE.Scene();
const occluderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black material

// Add clones of occluding objects to the occluder scene
scene.traverse((object) => {
    if (object instanceof THREE.Mesh && object !== sunMesh) {
        const clone = object.clone();
        clone.material = occluderMaterial;
        occluderScene.add(clone);
    }
});


const godraysPass = new GodRaysPass(
    sunMesh, // The light source object
    camera,
    scene, // Pass the main scene here for depth check
    occluderScene, // Pass the occluder scene
    { // Options object
        resolutionScale: 0.6, // Lower resolution for performance
        density: 0.96,
        decay: 0.93,
        weight: 0.6,
        exposure: 0.4,
        samples: 60, // Number of samples for the blur
        blur: true // Enable blur for smoother rays
    }
);

composer.addPass(godraysPass);


// Animation loop
function animate() {
    requestAnimationFrame(animate);

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // Update sun position slightly for effect (optional)
    // sunMesh.position.y = 5 + Math.sin(Date.now() * 0.001) * 0.5;

    // Render using the composer
    composer.render();
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}, false);

animate();

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GodRaysPass } from 'three/addons/postprocessing/GodRaysPass.js';

let scene, camera, renderer, controls, composer, sunMesh, clock;

function init() {
    // Scene setup
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 25);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x111111); // Low ambient light
    scene.add(ambientLight);

    // God Rays Source Object (Bright Sphere)
    const sunRadius = 2;
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
    // Use MeshBasicMaterial so it's always bright regardless of scene lighting
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffddaa,
        transparent: true, // Needed for god rays to "shine through"
        opacity: 0.9 // Slightly transparent to avoid harsh edges
    });
    sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.position.set(0, 8, -20); // Position the sun
    scene.add(sunMesh);

    // Occluding Objects (Pillars)
    const pillarRadius = 0.7;
    const pillarHeight = 15;
    const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 32);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x333344, // Dark material
        roughness: 0.8,
        metalness: 0.1
    });

    const numPillars = 12;
    const circleRadius = 12;
    for (let i = 0; i < numPillars; i++) {
        const angle = (i / numPillars) * Math.PI * 2;
        const pillarMesh = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillarMesh.position.x = Math.cos(angle) * circleRadius;
        pillarMesh.position.z = Math.sin(angle) * circleRadius - circleRadius * 1.2; // Position them in front of sun
        pillarMesh.position.y = -pillarHeight / 4; // Sink them slightly
        pillarMesh.rotation.y = Math.random() * Math.PI;
        scene.add(pillarMesh);
    }

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -pillarHeight / 2 - pillarRadius;
    scene.add(floorMesh);

    // Post-processing setup
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // --- God Rays Pass Setup ---
    // Create a separate scene containing only the occluders (pillars) rendered black.
    const occluderScene = new THREE.Scene();
    const occluderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    scene.traverse((node) => {
        // Clone only the pillar meshes into the occluder scene
        if (node instanceof THREE.Mesh && node.geometry instanceof THREE.CylinderGeometry) {
            const occluderMesh = node.clone();
            occluderMesh.material = occluderMaterial; // Use the black material
            occluderScene.add(occluderMesh);
        }
    });

    // Ensure the sun mesh itself isn't in the occluder scene
    const sunOccluderClone = sunMesh.clone();
    sunOccluderClone.material = occluderMaterial; // Render sun black in occlusion pass
    occluderScene.add(sunOccluderClone);

    const godraysPass = new GodRaysPass(
        sunMesh, // The light source object
        camera,
        scene, // Main scene (only needed if using depth-based occlusion, but good practice)
        occluderScene, // Occlusion scene
        { // Options
            resolutionScale: 0.75, // Lower for performance, higher for quality
            density: 0.98,       // Intensity of rays
            decay: 0.95,         // How fast rays fade out
            weight: 0.6,         // Overall contribution weight
            exposure: 0.5,       // Brightness exposure
            samples: 100,         // Ray sampling quality (higher is expensive)
            clampMax: 1.0,        // Clamp max brightness
            blur: false          // Optional blur pass (can be expensive)
        }
    );

    composer.addPass(godraysPass);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    controls.update(delta);

    // Subtle sun movement (optional)
    sunMesh.position.y = 8 + Math.sin(elapsed * 0.5) * 1;

    // Render using the composer
    composer.render(delta);
}

init();
animate();


