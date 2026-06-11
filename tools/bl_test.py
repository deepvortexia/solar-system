import bpy
_result = f"Blender {bpy.app.version_string} | engine={bpy.context.scene.render.engine} | objects={[o.name for o in bpy.data.objects]}"
