import bpy
import sys
import importlib.util

# Build Rosalys in her own scene so neither the solar-system nor the (Terra) Mascot
# scene is touched. Mirrors mascot_00_setup.py.
sc = bpy.data.scenes.get("Rosalys")
if sc is None:
    sc = bpy.data.scenes.new("Rosalys")
bpy.context.window.scene = sc

# clear any previous Rosalys objects (idempotent re-runs)
for ob in list(sc.collection.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

# soft neutral world so emissive bracelets/rose/wings read nicely
world = bpy.data.worlds.get("RosalysWorld") or bpy.data.worlds.new("RosalysWorld")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.02, 0.02, 0.04, 1.0)
    bg.inputs[1].default_value = 1.0

# (re)load the shared helper module used by the planet/Terra pipeline
spec = importlib.util.spec_from_file_location(
    "sshelp", r"C:\Users\Yan\deepvortex-repos\solar-system\tools\blender\sshelp.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["sshelp"] = mod
spec.loader.exec_module(mod)

_result = f"Rosalys scene active; objects={len(sc.collection.objects)}; helpers loaded"
