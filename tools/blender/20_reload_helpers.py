import sys
import importlib.util

spec = importlib.util.spec_from_file_location(
    "sshelp", r"C:\Users\Yan\deepvortex-repos\solar-system\tools\blender\sshelp.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["sshelp"] = mod
spec.loader.exec_module(mod)
_result = "helpers reloaded (retexture available: %s)" % hasattr(mod, "retexture")
