# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('data', 'data')]
binaries = []
hiddenimports = ['google.generativeai', 'PIL', 'fal_client']
tmp_ret = collect_all('google.generativeai')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('google.ai.generativelanguage')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

# Exclude unnecessary modules to reduce size
excludes = [
    'tkinter', '_tkinter', 'tcl', 'tk',
    'matplotlib', 'scipy', 'pandas', 'numpy.testing',
    'pytest', 'unittest', 'test', 'tests',
    'IPython', 'jupyter', 'notebook',
    'setuptools', 'pkg_resources',
    'pydoc', 'doctest',
    'xml.sax.expatreader',
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=2,
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
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
