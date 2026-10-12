//NAME(PL_VCOL_PITCHVERT)
Import:(precision.h)
attribute vec4 Position;
attribute vec4 TexCoord;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying mediump vec2 texcoord1;
varying mediump vec2 texcoord2;
varying mediump vec2 texcoord3;

uniform vec4 UVTrans0;
uniform vec4 UVTrans1;

void main(){
	gl_Position=MVPMatrix*Position;
	texcoord1.xy = (TexCoord.xy * UVTrans0.zw) + UVTrans0.xy;
	texcoord2.xy =((MMatrix*Position).xy*vec2(0.00004,0.00004)+vec2(0.5,0.5)) * UVTrans1.zw + UVTrans1.xy;
	texcoord3.x = (texcoord1.x - 0.0) * 0.167;
	texcoord3.y = ((texcoord1.y - 0.99) * 0.119);
}
