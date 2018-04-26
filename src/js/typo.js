
const jsonLoader = new THREE.JSONLoader();

export default class Typo {
  constructor(jsonPath) {
    this.jsonPath = jsonPath;
  }

  create(){
    return new Promise(resolve => {
      loadJson( this.jsonPath).then(function(response){
        resolve(response);
      });
    });

  }

  fillTexture(texture,vertices){
    // textureのイメージデータをいったん取り出す
    let posArray = texture.image.data;
  
    for (let y = 0; y < tWidth; y++) {
      for (let x = 0; x < tWidth; x++) {
        let l = x + y * tWidth;
        let n = l;
        n = n * 4;
  
        //パーティクルの初期値
        posArray[n + 0] = vertices[l].x; //X
        posArray[n + 1] = vertices[l].y; //Y
        posArray[n + 2] = vertices[l].z; //Z
        posArray[n + 3] = 0; //W
      }
    }
  }
}

let loadJson = (jsonPath) => {
  return new Promise(resolve => {
    jsonLoader.load(jsonPath, function (geometry) {
      resolve(geometry);
    });
  });
};


