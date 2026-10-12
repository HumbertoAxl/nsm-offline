//NAME(SEGMENTVERT)
attribute vec4 Position;
attribute vec4 TexCoord;
attribute vec4 Color;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying vec2 texcoord;
varying vec4 pos;
varying vec4 color;

void main(){
	gl_Position=MVPMatrix*Position;
	pos = Position;
	texcoord = TexCoord.xy;
	color = Color;
}
