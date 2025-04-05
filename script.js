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
    // Create a separate scene containing only the occluders (pillars AND the sun itself, rendered black).
    const occluderScene = new THREE.Scene();
    occluderScene.background = null;
    const occluderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    scene.traverse((node) => {
        if (node instanceof THREE.Mesh && node !== sunMesh) { // Exclude the original sun
             const occluderMesh = node.clone();
             occluderMesh.material = occluderMaterial;
             occluderScene.add(occluderMesh);
        }
    });

    // Clone sun with a unique identifier for easier lookup in animate loop
    function cloneSunForOcclusion(sunMesh, occluderMaterial) {
        const sunOccluderClone = sunMesh.clone();
        sunOccluderClone.material = occluderMaterial;
        sunOccluderClone.uuid = sunMesh.uuid + '_occluder_clone'; // Add identifier
        return sunOccluderClone;
    }

    // Add the black sun clone using the helper function
    const sunOccluder = cloneSunForOcclusion(sunMesh, occluderMaterial);
    occluderScene.add(sunOccluder);

    // ... (godraysPass setup as before, ensure correct occluderScene is passed) ...
     const godraysPass = new GodRaysPass(
        sunMesh,
        camera,
        scene, // Pass main scene - might be unused but good practice
        occluderScene, // Pass the scene with black occluders
        { // Options
            resolutionScale: 0.7,
            density: 0.96,
            decay: 0.94,
            weight: 0.6,
            exposure: 0.5,
            samples: 80,
            clampMax: 1.0,
            blur: false
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

    // Subtle sun movement
    sunMesh.position.y = 8 + Math.sin(elapsed * 0.5) * 1;

    // Find the specific sun occluder clone and update its position
    const occluderScene = godraysPass.occluderScene; // Access occluder scene from the pass
    if (occluderScene) {
        const sunOccluder = occluderScene.getObjectByProperty('uuid', sunMesh.uuid + '_occluder_clone');
        if (sunOccluder) {
            sunOccluder.position.copy(sunMesh.position);
            // Ensure world matrix is updated if needed, though position copy should suffice
            // sunOccluder.updateMatrixWorld();
        }
    }

    composer.render(delta);
}

init();
animate();