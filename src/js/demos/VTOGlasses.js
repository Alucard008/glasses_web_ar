import React, { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import VTOButton from '../components/VTOButton.js';
import NN from '../contrib/WebARRocksFace/neuralNets/NN_GLASSES_9.json';
import mirrorHelper from '../contrib/WebARRocksFace/helpers/WebARRocksMirror.js';
import GLTFModel1 from '../../assets/VTOGlasses/models3D/glasses2.glb';
import GLTFModel2 from '../../assets/VTOGlasses/models3D/Red Glasses.glb';
import GLTFOccluderModel from '../../assets/VTOGlasses/models3D/occluder1.glb';
import envMap from '../../assets/VTOGlasses/envmaps/venice_sunset_1k.hdr';
import * as THREE from 'three';

let _threeFiber = null;

const get_pauseButtonText = (isPaused) => {
  return isPaused ? 'Resume' : 'Pause';
};

const ThreeGrabber = (props) => {
  const threeFiber = useThree();
  _threeFiber = threeFiber;

  useFrame(mirrorHelper.update.bind(null, props.sizing, threeFiber.camera));
  mirrorHelper.set_lighting(threeFiber.gl, threeFiber.scene, props.lighting);

  return null;
};

const compute_sizing = () => {
  const height = window.innerHeight;
  const wWidth = window.innerWidth;
  const width = Math.min(wWidth, height);
  const top = 0;
  const left = (wWidth - width) / 2;
  return { width, height, top, left };
};

const VTOModelContainer = (props) => {
  mirrorHelper.clean();
  const normalScale = 80;
  const objRef = useRef();
  const modelRef = useRef();

  useEffect(() => {
    const threeObject3DParent = objRef.current;
    if (threeObject3DParent.children.length === 0) return;
    const threeObject3D = threeObject3DParent.children[0];
    if (threeObject3D.children.length === 0) return;
    const model = threeObject3D.children[0];

    mirrorHelper.set_glassesPose(model);
    mirrorHelper.tweak_materials(model, props.glassesBranches);
    mirrorHelper.set_faceFollower(
      threeObject3DParent,
      threeObject3D,
      props.faceIndex
    );

    modelRef.current = model; // Save a reference to the model
  }, [props.GLTFModel, props.sizing]);

  const gltf = useLoader(GLTFLoader, props.GLTFModel);
  const model = gltf.scene.clone();
  modelRef.current = model;

  const isDebugOccluder = false;
  const gltfOccluder = useLoader(GLTFLoader, props.GLTFOccluderModel);
  const occluderModel = gltfOccluder.scene.clone();
  const occluderMesh = mirrorHelper.create_occluderMesh(
    occluderModel,
    isDebugOccluder
  );

  // Track the model's position and adjust visibility based on proximity to the camera
  useFrame(({ camera }) => {
    if (modelRef.current) {
      const currentPosition = new THREE.Vector3();
      modelRef.current.getWorldPosition(currentPosition);

      // Calculate the distance from the camera to the glasses model
      const distanceToCamera = camera.position.distanceTo(currentPosition);
      console.log('distance', distanceToCamera);

      // Check if the model is too close to the camera
      if (distanceToCamera < 100 || distanceToCamera > 550) {
        // Hide the model if it's too close or too far from the camera
        modelRef.current.visible = true;

        // Show the popup
        if (props.popUpRef.current) {
          props.popUpRef.current.style.display = 'none';
        }
      } else {
        // Show the model and hide the popup when within optimal range
        modelRef.current.visible = false;

        // Hide the popup
        if (props.popUpRef.current) {
          props.popUpRef.current.style.display = 'block';
        }
      }
    }
  });

  return (
    <object3D ref={objRef}>
      <object3D>
        <primitive object={model} />
        <primitive object={occluderMesh} />
      </object3D>
    </object3D>
  );
};

const DebugCube = (props) => {
  const s = props.size || 1;
  return (
    <mesh name="debugCube">
      <boxBufferGeometry args={[s, s, s]} />
      <meshNormalMaterial />
    </mesh>
  );
};

const VTOGlasses = (props) => {
  const PI = 3.1415;
  const scale = 100;

  const [sizing, setSizing] = useState(compute_sizing());
  const [model, setModel] = useState(GLTFModel1);
  const [isInitialized] = useState(true);
  const [choice, setChoice] = useState(false);
  const [modelChoice, setModelChoice] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  const togglePauseRef = useRef();
  const canvasFaceRef = useRef();
  const popUpRef = useRef();

  const _settings = {
    glassesBranches: {
      fadingZ: -0.9,
      fadingTransition: 0.6,
      bendingAngle: 5,
      bendingZ: 0,
    },
    lighting: {
      envMap,
      pointLightIntensity: 0.8,
      pointLightY: 200,
      hemiLightIntensity: 0,
    },
    GLTFOccluderModel,
    bloom: {
      threshold: 0.5,
      intensity: 8,
      kernelSizeLevel: 0,
      computeScale: 2,
      luminanceSmoothing: 0.7,
    },
  };
  let _timerResize = null;
  let _isPaused = false;

  const handle_resize = () => {
    if (_timerResize) {
      clearTimeout(_timerResize);
    }
    _timerResize = setTimeout(do_resize, 200);
  };

  const do_resize = () => {
    _timerResize = null;
    const newSizing = compute_sizing();
    setSizing(newSizing);
  };

  useEffect(() => {
    if (_timerResize === null) {
      mirrorHelper.resize();
    }
  }, [sizing]);

  const toggle_pause = () => {
    if (_isPaused) {
      mirrorHelper.resume(true);
    } else {
      mirrorHelper.pause(true);
    }
    _isPaused = !_isPaused;
    togglePauseRef.current.innerHTML = get_pauseButtonText(_isPaused);
  };

  const capture_image = () => {
    const threeCanvas = _threeFiber.gl.domElement;
    mirrorHelper.capture_image(threeCanvas).then((cv) => {
      const dataURL = cv.toDataURL('image/png');
      const img = new Image();
      img.src = dataURL;
      img.onload = () => {
        const win = window.open('');
        win.document.write(img.outerHTML);
      };
    });
  };

  useEffect(() => {
    mirrorHelper
      .init({
        NN,
        scanSettings: {
          threshold: 0.8,
        },
        landmarksStabilizerSpec: {
          beta: 10,
          minCutOff: 0.001,
          freqRange: [2, 144],
          forceFilterNNInputPxRange: [2.5, 6],
        },
        solvePnPImgPointsLabels: [
          'leftEarBottom',
          'rightEarBottom',
          'noseBottom',
          'noseLeft',
          'noseRight',
          'leftEyeExt',
          'rightEyeExt',
        ],
        canvasFace: canvasFaceRef.current,
        maxFacesDetected: 1,
      })
      .then(() => {
        window.addEventListener('resize', handle_resize);
        window.addEventListener('orientationchange', handle_resize);
        console.log('WEBARROCKSMIRROR helper has been initialized');
      });

    return () => {
      _threeFiber = null;
      return mirrorHelper.destroy();
    };
  }, [isInitialized]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setModelChoice(e.target.result);
      setChoice(true);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (choice) {
      setModel(modelChoice);
      setChoice(false);
    }
  }, [modelChoice, choice]);

  return (
    <div>
      <Canvas
        className="mirrorX"
        style={{
          position: 'fixed',
          zIndex: 2,
          ...sizing,
        }}
        gl={{
          preserveDrawingBuffer: true,
        }}
        updateDefaultCamera={false}
      >
        <ThreeGrabber sizing={sizing} lighting={_settings.lighting} />

        <Suspense fallback={<DebugCube />}>
          <VTOModelContainer
            sizing={sizing}
            GLTFModel={model}
            GLTFOccluderModel={_settings.GLTFOccluderModel}
            faceIndex={0}
            glassesBranches={_settings.glassesBranches}
            // setShowPopup={setShowPopup}
            popUpRef={popUpRef}
          />
        </Suspense>

        <EffectComposer>
          <Bloom
            luminanceThreshold={_settings.bloom.threshold}
            luminanceSmoothing={_settings.bloom.luminanceSmoothing}
            intensity={_settings.bloom.intensity}
            kernelSize={_settings.bloom.kernelSizeLevel}
            height={_settings.bloom.computeScale * sizing.height}
          />
        </EffectComposer>
      </Canvas>

      <canvas
        className="mirrorX"
        ref={canvasFaceRef}
        style={{
          position: 'fixed',
          zIndex: 1,
          ...sizing,
        }}
        width={sizing.width}
        height={sizing.height}
      />

      <div className="VTOButtons">
        <VTOButton onClick={() => setModel(GLTFModel1)}>Glasses 1</VTOButton>
        <VTOButton onClick={() => setModel(GLTFModel2)}>Glasses 2</VTOButton>
        <VTOButton>
          {' '}
          <input type="file" accept=".glb,.gltf" onChange={handleFileChange} />
        </VTOButton>
        <VTOButton ref={togglePauseRef} onClick={toggle_pause}>
          {get_pauseButtonText(_isPaused)}
        </VTOButton>
        <VTOButton onClick={capture_image}>Capture</VTOButton>
      </div>

      <div
        ref={popUpRef}
        style={{
          display: 'none',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          // padding: '20px',
          // backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'red',
          borderRadius: '10px',
          zIndex: 10,
        }}
      >
        Please move back a little
      </div>
    </div>
  );
};

export default VTOGlasses;
