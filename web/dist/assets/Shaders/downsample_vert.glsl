//NAME(VERTEX)
attribute vec4 Position;
attribute vec2 TexCoord;
attribute vec4 Color;
uniform mat4 MVPMatrix;
varying vec2 texCoord;
varying vec4 vcolor;
void main()
{
gl_Position=MVPMatrix * Position;
texCoord=TexCoord;
vcolor=Color;
}
