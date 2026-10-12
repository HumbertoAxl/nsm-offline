//NAME(ZSAFEGRADIENTFRAG)
Import:(precision.h)
uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
varying vec2 texCoord;
varying vec2 texCoord2;
varying vec4 vcolor;
//DEPTHTEST=ON

uniform vec4 gradtop;
uniform vec4 gradbot;
uniform vec4 gradposfade;

void main()
{
vec4 grad = mix(gradtop,gradbot,clamp(texCoord2.y,0.0,1.0));
gl_FragColor.xyzw=texture2D( TexSamp0,texCoord ).xyzw*grad*vcolor.rgba;
}
