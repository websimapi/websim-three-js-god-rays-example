import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GodRaysPass } from 'three/addons/postprocessing/GodRaysPass.js';

let scene, camera, renderer, controls, composer, sunMesh, clock;
let godraysPass;

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 25);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.target.set(0, 2, 0);

    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 15, 5);
    scene.add(dirLight);

    const sunRadius = 2;
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffddaa,
    });
    sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.position.set(0, 8, -20);
    scene.add(sunMesh);

    const pillarRadius = 0.7;
    const pillarHeight = 15;
    const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 32);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x333344,
        roughness: 0.8,
        metalness: 0.1
    });

    const numPillars = 12;
    const circleRadius = 12;
    for (let i = 0; i < numPillars; i++) {
        const angle = (i / numPillars) * Math.PI * 2;
        const pillarMesh = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillarMesh.position.x = Math.cos(angle) * circleRadius;
        pillarMesh.position.z = Math.sin(angle) * circleRadius - circleRadius * 1.5;
        pillarMesh.position.y = -pillarHeight / 4;
        pillarMesh.rotation.y = Math.random() * Math.PI;
        scene.add(pillarMesh);
    }

    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -pillarHeight / 2 - pillarRadius;
    scene.add(floorMesh);

    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const occluderScene = new THREE.Scene();
    occluderScene.background = null;

    const occluderMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
    });

    scene.traverse((node) => {
        if (node.isMesh && node.geometry instanceof THREE.CylinderGeometry) {
             const occluderMesh = node.clone();
             occluderMesh.material = occluderMaterial;
             occluderScene.add(occluderMesh);
        }
    });

    const sunOccluder = sunMesh.clone();
    sunOccluder.material = occluderMaterial;
    sunOccluder.userData.isSunOccluder = true;
    occluderScene.add(sunOccluder);

    godraysPass = new GodRaysPass(
        sunMesh,
        camera,
        occluderScene,
        {
            resolutionScale: 0.6,
            density: 0.97,
            decay: 0.95,
            weight: 0.6,
            exposure: 0.45,
            samples: 100,
            clampMax: 1.0
        }
    );
    composer.addPass(godraysPass);

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    controls.update();

    sunMesh.position.y = 8 + Math.sin(elapsed * 0.5) * 1.5;
    sunMesh.position.x = Math.cos(elapsed * 0.3) * 1.0;

    if (godraysPass && godraysPass.occluderScene) {
        const sunOccluder = godraysPass.occluderScene.children.find(child => child.userData.isSunOccluder);
        if (sunOccluder) {
            sunOccluder.position.copy(sunMesh.position);
            sunOccluder.rotation.copy(sunMesh.rotation);
            sunOccluder.scale.copy(sunMesh.scale);
        }
    }

    composer.render(delta);
}

init();
animate();