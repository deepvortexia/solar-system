import bpy
import sys
import importlib.util

# wipe scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.orphans_purge(do_recursive=True)

# black world background
world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
if bg:
    bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    bg.inputs[1].default_value = 0.0

# (re)load helper module
spec = importlib.util.spec_from_file_location(
    "sshelp", r"C:\Users\Yan\deepvortex-repos\solar-system\tools\blender\sshelp.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["sshelp"] = mod
spec.loader.exec_module(mod)

_result = f"Scene cleared, world black, helpers loaded. Objects: {len(bpy.data.objects)}"
