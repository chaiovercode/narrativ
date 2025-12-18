# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[('services', 'services'), ('utils', 'utils'), ('config.py', '.'), ('data', 'data')],
    hiddenimports=['uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off', 'google.genai', 'PIL', 'PIL.Image', 'feedparser', 'pydantic', 'multipart', 'dotenv', 'services', 'services.research', 'services.image_gen', 'services.image', 'services.styles', 'services.brand', 'services.boards', 'services.notes', 'services.trending', 'services.rss', 'services.clients', 'services.llm', 'services.consistency', 'services.aesthetic', 'services.caption', 'services.text_to_slides', 'utils', 'utils.vault', 'utils.text', 'utils.cache', 'utils.search', 'utils.json_utils', 'duckduckgo_search', 'huggingface_hub'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'pandas', 'numpy.testing', 'numpy.distutils', 'numpy.f2py', 'PIL.ImageQt', 'PIL.ImageTk', 'unittest', 'pytest', 'setuptools', 'pip', 'wheel', 'pkg_resources', 'distutils', 'lib2to3', 'email.test', 'test', 'xmlrpc', 'pydoc', 'doctest', 'torch', 'torchvision', 'torchaudio', 'pyarrow', 'zmq', 'IPython', 'jupyter', 'notebook', 'jedi', 'parso', 'sympy', 'nltk', 'networkx', 'pygments', 'lxml', 'numpy', 'cv2', 'sklearn', 'transformers', 'tensorflow', 'keras', 'boto3', 'botocore', 'awscli', 'azure', 'google.cloud'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='narrativ-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
