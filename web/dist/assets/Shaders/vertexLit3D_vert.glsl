//NAME(VERTEXLIT3DVERT)
attribute vec4 Position;
attribute vec2 TexCoord;
attribute vec4 Color;
uniform mat4 MVPMatrix;
varying vec2 texcoord;
varying vec4 vcolor;

uniform vec4 UVTrans0;

void main(){
	gl_Position=MVPMatrix*Position;
	texcoord = (TexCoord.xy * UVTrans0.zw) + UVTrans0.xy;
	vcolor=Color;
}