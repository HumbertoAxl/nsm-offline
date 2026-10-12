//NAME(ZSAFEGRADIENTVERT)
attribute vec4 Position;
attribute vec2 TexCoord;
attribute vec4 Color;
uniform mat4 MVPMatrix;
varying vec2 texCoord;
varying vec2 texCoord2;
varying vec4 vcolor;
uniform vec4 gradposfade;
void main()
{
	gl_Position=MVPMatrix * Position;
	texCoord=TexCoord;
	texCoord2=vec2(0.5,(Position.y-gradposfade.x)/gradposfade.y);
	vcolor=Color;
}