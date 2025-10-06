import Phaser from 'phaser'

const fragmentShader = `
#define SHADER_NAME CRT_FILTER

precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;

varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;

  // Scanlines
  float scanline = sin(uv.y * 800.0) * 0.04;

  // RGB shift for chromatic aberration
  float offset = 0.002;
  vec4 color;
  color.r = texture2D(uMainSampler, vec2(uv.x + offset, uv.y)).r;
  color.g = texture2D(uMainSampler, uv).g;
  color.b = texture2D(uMainSampler, vec2(uv.x - offset, uv.y)).b;
  color.a = 1.0;

  // Apply scanlines
  color.rgb -= scanline;

  // Vignette effect
  vec2 position = uv - 0.5;
  float vignette = 1.0 - dot(position, position) * 0.5;
  color.rgb *= vignette;

  gl_FragColor = color;
}
`

export class CRTPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'CRTPostFX',
      fragShader: fragmentShader
    })
  }
}
