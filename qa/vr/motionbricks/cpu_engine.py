"""Run the MotionBricks SOMA engine on the CPU: Warp kernels on the CPU device, the one inference call on ONNX Runtime.

The MotionBricks runtime needs TensorRT (an NVIDIA GPU). Only its InferenceEngine base touches TensorRT, so this module stubs
the tensorrt import and replaces that base's GPU parts. Everything else (pose encoding, decoding, endpoint correction) is the
release's own code. Import it before anything from motionbricks.
"""
from __future__ import annotations

import contextlib
import sys
import types
from pathlib import Path

import numpy as np
import onnxruntime as ort
import warp as wp


class _Any(type):
    def __getattr__(cls, name):
        return cls


class _Dummy(metaclass=_Any):
    def __init__(self, *a, **k):
        pass


def _stub_tensorrt():
    m = types.ModuleType("tensorrt")
    m.__version__ = "0.0-cpu-stub"
    m.__getattr__ = lambda name: _Dummy
    sys.modules["tensorrt"] = m


def install(src_root: str | Path):
    """Put the release on sys.path and patch it for the CPU. Returns MotionBricksSOMAEngine."""
    sys.path.insert(0, str(src_root))
    _stub_tensorrt()
    wp.init()
    wp.set_device("cpu")

    from motionbricks.inference import engine as ie
    from motionbricks.inference.types import TensorMode, TensorSpec
    import motionbricks.model.engine as me
    from motionbricks.model.soma.contract import SOMA_N1_CONTRACT

    class NoTimer:
        def __init__(self, stream):
            self.milliseconds = {}

        @contextlib.contextmanager
        def stage(self, name):
            yield

        def read(self):
            pass

    me.GenerationTimer = NoTimer

    def init(self, onnx_path, **kw):
        self._closed = False
        self._cuda_graph = None
        self._onnx_path = Path(onnx_path)
        so = ort.SessionOptions()
        so.intra_op_num_threads = 4
        self._session = ort.InferenceSession(str(onnx_path), so, providers=["CPUExecutionProvider"])
        specs = {}
        for s in SOMA_N1_CONTRACT.tensor_specs:
            specs[s.name] = s
        self._tensor_specs = types.MappingProxyType(specs)
        self._buffers = {s.name: wp.zeros(s.shape, dtype=wp.dtype_from_numpy(s.dtype), device="cpu") for s in specs.values()}

    def enqueue(self):
        ins = {s.name: self._buffers[s.name].numpy() for s in self._tensor_specs.values() if s.mode == TensorMode.INPUT}
        names = [o.name for o in self._session.get_outputs()]
        for name, value in zip(names, self._session.run(names, ins)):
            self._buffers[name].assign(wp.array(np.ascontiguousarray(value), dtype=self._buffers[name].dtype, device="cpu"))

    ie.InferenceEngine.__init__ = init
    ie.InferenceEngine.enqueue_async = enqueue
    ie.InferenceEngine.synchronize = lambda self: None
    ie.InferenceEngine.bake_cuda_graph = lambda self: None
    ie.InferenceEngine.stream = property(lambda self: None)
    ie.InferenceEngine.device = property(lambda self: wp.get_device("cpu"))
    ie.InferenceEngine.close = lambda self: setattr(self, "_closed", True)
    ie.InferenceEngine._discard_resources = lambda self, synchronize=False: None

    from motionbricks.model.soma.engine import MotionBricksSOMAEngine
    return MotionBricksSOMAEngine
