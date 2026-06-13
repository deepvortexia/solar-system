import bpy
import os

out = r"C:\Users\Yan\deepvortex-repos\solar-system\public\mascot.gltf"
os.makedirs(os.path.dirname(out), exist_ok=True)

sc = bpy.data.scenes.get("Mascot")
if sc is not None:
    bpy.context.window.scene = sc

fmts = bpy.ops.export_scene.gltf.get_rna_type().properties['export_format'].enum_items.keys()
fmt = 'GLTF_EMBEDDED' if 'GLTF_EMBEDDED' in fmts else 'GLTF_SEPARATE'

bpy.ops.export_scene.gltf(filepath=out, export_format=fmt,
                          export_apply=True, use_active_scene=True)

files = sorted(f for f in os.listdir(os.path.dirname(out)) if f.startswith("mascot"))
_result = f"Exported {fmt} -> {out}; mascot files: {files}"
