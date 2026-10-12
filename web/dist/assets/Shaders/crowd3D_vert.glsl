//NAME(CROWDVERT)
Import:(precision.h)
attribute vec4 Position;
attribute vec4 Normal;
attribute vec4 TexCoord;
attribute vec4 Position2;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying vec2 texcoord;
//varying vec2 texcoord2;
//varying mediump vec4 norm;
uniform vec4 UVTrans0;
uniform vec4 UVTrans1;

void main(){
	mediump vec4 posscaled;
	posscaled = (Position * vec4(532,552,788,1))+Position2;
	posscaled.w = 1.0;
	gl_Position=MVPMatrix*posscaled;
	//posscaled =MMatrix * (posscaled+Normal*vec2(1200.0,0.0).xxxy);
	//norm.x = (1.4-Normal.y)*(0.6-Position.z*0.7);
	texcoord.xy = (TexCoord.xy* UVTrans0.zw) + UVTrans0.xy;
	//texcoord2.xy =(posscaled.xy*vec2(0.00004,0.000043)+vec2(0.5,0.5));
}
