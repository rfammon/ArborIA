import os
import shutil

# List of files and directories to move
unused_items = [
    '.temp_logs_staging',
    'prints',
    'tests',
    'css/bundle.min.css',
    'style.min.css',
    'libs/leaflet.css',
    'js/Null.txt',
    'js/checklist.mobile.service.js',
    'js/constants.js',
    'js/data-content.js',
    'js/features_patch_v2.js',
    'js/features_temp.js',
    'js/loader.js',
    'js/sync.service.js',
    'js/test_write.js',
    'features.js',
    'patch_features.js',
    'test-gemini.js',
    'update_arboria.js',
    'ARQUITETURA-COORDENADAS.md',
    'README.md',
    'TESTE-NOVA-ARQUITETURA.md',
    'protocolo_testes.md',
    'opencode.json',
    'config_zed.sh',
    'fix-missing-columns.sql',
    'schema_alignment.sql',
    'setup_database.sql',
    'setup_images_table.sql',
    'supabase-schema.sql',
    'update_schema_altura.sql',
    'update_schema_photos.sql',
    'Node.js',
    'ProcedimentoCorteePodadervores_Rev00.html',
    'exemplo.html',
    'image_1.png',
    'md',
    'resize_logo.py',
    'test-utm-fields.html',
    'test_write.txt',
    'audit_runner.cjs',
    'bridge.cjs',
]

# Destination directory
dest_dir = 'unused_files'

# Create destination directory if it doesn't exist
if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

# Move each item
for item in unused_items:
    try:
        shutil.move(item, dest_dir)
        print(f"Moved {item} to {dest_dir}")
    except FileNotFoundError:
        print(f"Could not find {item}, skipping.")
    except Exception as e:
        print(f"Error moving {item}: {e}")

print("File moving process completed.")
