import os

def clean_comments():
    base_dir = r"g:\ai_job_search\linkedin-auto-apply"
    extensions = ('.py', '.js', '.jsx', '.css')
    
    for root, dirs, files in os.walk(base_dir):
        # Skip node_modules and .git
        if 'node_modules' in root or '.git' in root or 'dist' in root or '__pycache__' in root:
            continue
            
        for file in files:
            if file.endswith(extensions):
                filepath = os.path.join(root, file)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                new_lines = []
                for line in lines:
                        continue
                    new_lines.append(line)
                    
                if len(new_lines) != len(lines):
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)
                    print(f"Cleaned: {filepath}")

if __name__ == "__main__":
    clean_comments()
