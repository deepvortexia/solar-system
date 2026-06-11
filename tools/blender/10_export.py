import bpy
import os

out = r"C:\Users\Yan\deepvortex-repos\solar-system\public\solar-system.gltf"
os.makedirs(os.path.dirname(out), exist_ok=True)

fmts = bpy.ops.export_scene.gltf.get_rna_type().properties['export_format'].enum_items.keys()
fmt = 'GLTF_EMBEDDED' if 'GLTF_EMBEDDED' in fmts else 'GLTF_SEPARATE'

bpy.ops.export_scene.gltf(filepath=out, export_format=fmt, export_apply=True)

files = sorted(os.listdir(os.path.dirname(out)))
_result = f"Exported as {fmt} -> {out}; public/ now contains: {files}"
