//NAME(PL_VCOLVERT)
Import:(precision.h)
Import:(courtproject.h)

attribute vec4 Position;
attribute vec4 TexCoord;
attribute vec4 Color;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying mediump vec2 texcoord1;
varying mediump vec2 texcoord2;
varying lowp vec4 color;

uniform vec4 UVTrans0;
uniform vec4 UVTrans1;

void main(){
	gl_Position=MVPMatrix*Position;
	texcoord1.xy = (TexCoord.xy * UVTrans0.zw) + UVTrans0.xy;
	texcoord2.xy =((MMatrix*Position).xy*vec2(0.00002,0.0000215)+vec2(0.5,0.5)) * UVTrans1.zw + UVTrans1.xy;
	color = Color;
}
