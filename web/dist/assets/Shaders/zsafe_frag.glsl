//NAME(PIXEL)
Import:(precision.h)
uniform sampler2D TexSamp0;
varying vec2 texCoord;
varying vec4 vcolor;
//DEPTHTEST=ON
void main()
{
gl_FragColor.xyzw=texture2D( TexSamp0,texCoord ).xyzw*vcolor.rgba;
}
