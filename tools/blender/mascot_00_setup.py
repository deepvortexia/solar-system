import bpy
import sys
import importlib.util

# Build the mascot in its own scene so the solar-system scene is untouched.
sc = bpy.data.scenes.get("Mascot")
if sc is None:
    sc = bpy.data.scenes.new("Mascot")
bpy.context.window.scene = sc

# clear any previous mascot objects (idempotent re-runs)
for ob in list(sc.collection.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

# soft neutral world so emissive flames/halo read nicely
world = bpy.data.worlds.get("MascotWorld") or bpy.data.worlds.new("MascotWorld")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.02, 0.02, 0.04, 1.0)
    bg.inputs[1].default_value = 1.0

# (re)load the shared helper module used by the planet pipeline
spec = importlib.util.spec_from_file_location(
    "sshelp", r"C:\Users\Yan\deepvortex-repos\solar-system\tools\blender\sshelp.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["sshelp"] = mod
spec.loader.exec_module(mod)

_result = f"Mascot scene active; objects={len(sc.collection.objects)}; helpers loaded"
