//ライブラリの読み込み
const Stats = require('stats.js');
const glslify = require('glslify');
const createBackground = require('three-vignette-background');

//GLSLの定義
const computeShaderPosition = glslify('../js/shaders/computeShaderPosition.frag');
const particleVertexShader = glslify('../js/shaders/particleVertexShader.vert');
const particleFragmentShader = glslify('../js/shaders/particleFragmentShader.frag');

//WEBGLに対応しているか確認
if (!Detector.webgl) Detector.addGetWebGLMessage();

const WIDTH = 50;
const PARTICLES = WIDTH * WIDTH;
const CLOCK = new THREE.Clock();

// メモリ負荷確認用
let stats;

// 基本セット
let container, camera, scene, renderer, geometry, controls;

//gpgpu関連
let gpuCompute,
  texturePosition,
  positionVariable,
  positionUniforms,
  particleUniforms;

// その他
let self, time, mouse;

export default class Bg {
  constructor() {
    // 一般的なThree.jsにおける定義部分
    container = document.createElement('div');
    document.body.appendChild(container);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 15000);
    camera.position.y = 1;
    camera.position.z = -3;
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0xFFFFFF);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    stats = new Stats();
    container.appendChild(stats.dom);
    window.addEventListener('resize', this.resize, false);

    let background = createBackground({
      noiseAlpha: 0.0,
      colors: ['#FFFFFF', '#FFFFFF']
    });
    scene.add(background);

    //その他の初期値
    self = this;
    time = 0;
    mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    this.initComputeRenderer();
    this.initPosition();
    this.animate();
  }

  initComputeRenderer() {
    gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

    let dtPosition = gpuCompute.createTexture();
    let dtVelocity = gpuCompute.createTexture();

    this.fillTextures(dtPosition, dtVelocity);

    positionVariable = gpuCompute.addVariable('texturePosition', computeShaderPosition, dtPosition);

    //uniform変数を追加
    positionUniforms = positionVariable.material.uniforms;
    positionUniforms.mouse = {
      value: mouse
    };

    positionUniforms.time = {
      value: time
    };

    //STEP 4 テクスチャ同士が参照し合えるようにする
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable]);

    //STEP 5　オフスクリーンレンダリング用のWebGLRenderTargetを作成する
    let error = gpuCompute.init();
    if (error !== null) {
      console.error(error);
    }

  }

  initPosition() {

    geometry = new THREE.BufferGeometry();
    let positions = new Float32Array(PARTICLES * 3);
    let p = 0;
    for (let i = 0; i < PARTICLES; i++) {
      positions[p++] = 0;
      positions[p++] = 0;
      positions[p++] = 0;
    }

    // uv情報の決定。テクスチャから情報を取り出すときに必要
    let uvs = new Float32Array(PARTICLES * 2);
    p = 0;
    for (let j = 0; j < WIDTH; j++) {
      for (let i = 0; i < WIDTH; i++) {
        uvs[p++] = i / (WIDTH - 1);
        uvs[p++] = j / (WIDTH - 1);

      }
    }

    // attributeをgeometryに登録する
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));


    // uniform変数をオブジェクトで定義
    // 今回はカメラをマウスでいじれるように、計算に必要な情報もわたす。
    particleUniforms = {
      texturePosition: {
        value: null
      },
      cameraConstant: {
        value: this.getCameraConstant(camera)
      }
    };

    let material = new THREE.ShaderMaterial({
      uniforms: particleUniforms,
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader
    });
    material.extensions.drawBuffers = true;
    let particles = new THREE.Points(geometry, material);
    particles.matrixAutoUpdate = false;
    particles.updateMatrix();

    // パーティクルをシーンに追加
    scene.add(particles);
  }

  fillTextures(texturePosition) {
    console.log(texturePosition)
    // textureのイメージデータをいったん取り出す
    let posArray = texturePosition.image.data;

    for (let y = 0; y < WIDTH; y++) {
      for (let x = 0; x < WIDTH; x++) {
        let n = x + y * WIDTH;
        n = n * 4;

        //パーティクルの初期値
        posArray[n + 0] = 0;//X
        posArray[n + 1] = 0;//Y
        posArray[n + 2] = 0;//Z
        posArray[n + 3] = 0;//W
      }
    }
  }

 getCameraConstant(camera) {
    return window.innerHeight / (Math.tan(THREE.Math.DEG2RAD * 0.5 * camera.fov) / camera.zoom);
  }

  animate() {
    requestAnimationFrame(self.animate);
    self.render();
    stats.update();
  }

  resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    
    gpuCompute.compute();

    //uniform変数を更新
    time = CLOCK.getElapsedTime();

    positionVariable.material.uniforms.time.value = time;

    // 計算した結果が格納されたテクスチャをレンダリング用のシェーダーに渡す
   particleUniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;

    renderer.render(scene, camera);
  }
}


