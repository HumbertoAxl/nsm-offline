//NAME(SIMPLE3DVERT)
attribute vec4 Position;
attribute vec4 TexCoord;
uniform mat4 MVPMatrix;
varying vec2 texcoord;

uniform vec4 UVTrans0;

void main(){
	gl_Position=MVPMatrix*Position;
	texcoord = (TexCoord.xy * UVTrans0.zw) + UVTrans0.xy;
}
