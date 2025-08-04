# Claude Code Python Error Checker Agent Specification

## Overview

The Claude Code Python Error Checker Agent is a specialized code analysis tool designed specifically for Python projects. It leverages Python's dynamic nature while providing comprehensive error detection across syntactic, semantic, type, static, and dynamic analysis dimensions, with deep integration into the Python ecosystem.

## Python-Specific Design Philosophy

- **Dynamic Language Awareness**: Handle Python's runtime flexibility while catching common pitfalls
- **Ecosystem Integration**: Deep integration with Python tools (pip, virtualenv, pytest, mypy, etc.)
- **Version Compatibility**: Support Python 2.7, 3.6+ with version-specific analysis
- **Framework Intelligence**: Specialized analysis for Django, Flask, FastAPI, NumPy, Pandas
- **REPL-Friendly**: Interactive analysis for Jupyter notebooks and Python REPL sessions

## Architecture for Python Projects

### Component Structure

```
Claude Code Python Error Checker
├── Python Parser Engine
│   ├── AST-based Syntax Analyzer (using ast module)
│   ├── Bytecode Analyzer (for compiled .pyc files)
│   └── Jupyter Notebook Parser (.ipynb support)
├── Python Semantic Analyzer
│   ├── Import Resolution System
│   ├── Dynamic Attribute Tracker
│   ├── Decorator Analysis Engine
│   └── Context Manager Validator
├── Python Type System
│   ├── Type Hint Checker (PEP 484/526/544)
│   ├── Duck Typing Analyzer
│   ├── Generic Type Resolver
│   └── Protocol Compliance Checker
├── Python Static Analyzer
│   ├── Package Dependency Analyzer
│   ├── Virtual Environment Inspector
│   ├── Security Scanner (bandit integration)
│   └── Performance Pattern Detector
├── Python Dynamic Analyzer
│   ├── Import-time Execution Simulator
│   ├── Memory Usage Predictor
│   ├── GIL Contention Detector
│   └── Exception Propagation Tracer
└── Python-Aware Reporting Engine
    ├── PEP 8 Style Checker
    ├── Pythonic Pattern Suggester
    └── Framework-Specific Advisor
```

## Python Error Detection Layers

### 1. Python Syntactic Error Detection

**Python-Specific Capabilities**:
- **Indentation Analysis**: Python's significant whitespace validation
- **String Formatting**: f-strings, .format(), % formatting validation
- **Comprehension Syntax**: List/dict/set comprehension correctness
- **Async/Await Syntax**: Coroutine and async context validation
- **Walrus Operator**: Assignment expression validation (Python 3.8+)
- **Pattern Matching**: match/case statement validation (Python 3.10+)

**Example Detection**:
```python
# Detected Issues:
def bad_function():
    if True:
    print("Hello")  # E001: IndentationError
    
name = "World"
print(f"Hello {name")  # E002: Unclosed f-string brace

# Python 3.10+ pattern matching
match value:
    case 1:
        return "one"
    case _:  # E003: Missing return in default case
```

### 2. Python Semantic Error Detection

**Python-Specific Capabilities**:
- **Import Analysis**: Missing modules, circular imports, relative import validation
- **Attribute Resolution**: Dynamic attribute access validation
- **Magic Method Validation**: Dunder method implementation correctness
- **Decorator Semantics**: Decorator application and execution order
- **Context Manager Protocol**: __enter__/__exit__ method validation
- **Generator/Iterator Protocol**: yield usage and iterator compliance

**Advanced Python Semantics**:
```python
# Import cycle detection
# file1.py
from file2 import function_b  # S001: Circular import detected

# Attribute access on None
user = get_user()  # Returns None in some cases
print(user.name)   # S002: Potential AttributeError on None

# Incorrect magic method
class CustomList:
    def __len__(self):
        return "five"  # S003: __len__ should return int

# Generator exhaustion
gen = (x for x in range(5))
list(gen)
list(gen)  # S004: Generator already exhausted
```

### 3. Python Type Error Detection

**Type Hint Integration**:
- **PEP 484 Compliance**: Function annotations, variable annotations
- **Generic Types**: TypeVar, Generic, Union, Optional validation
- **Protocol Types**: Structural subtyping (PEP 544)
- **Literal Types**: Literal value validation (PEP 586)
- **TypedDict**: Dictionary schema validation (PEP 589)
- **Dataclass Integration**: Field type validation

**Duck Typing Analysis**:
```python
from typing import Protocol, Union, Optional, List

# Protocol definition
class Drawable(Protocol):
    def draw(self) -> None: ...

def render(obj: Drawable) -> None:
    obj.draw()  # T001: Ensures obj has draw() method

# Union type validation
def process_id(user_id: Union[int, str]) -> str:
    return user_id.upper()  # T002: int has no upper() method

# Optional type handling
def get_name(user: Optional[dict]) -> str:
    return user["name"]  # T003: Possible None access

# List type validation
numbers: List[int] = [1, 2, "three"]  # T004: str not compatible with int
```

### 4. Python Static Analysis

**Python Ecosystem Analysis**:
- **Requirements Analysis**: requirements.txt, setup.py, pyproject.toml validation
- **Virtual Environment Consistency**: Package version conflicts
- **Import Optimization**: Unused imports, import sorting (isort style)
- **Security Scanning**: SQL injection, pickle usage, eval() calls
- **Package Structure**: __init__.py files, package hierarchy validation

**Framework-Specific Analysis**:

**Django Analysis**:
```python
# Django model validation
class User(models.Model):
    email = models.EmailField()
    password = models.CharField(max_length=20)  # A001: Password too short

# Django view validation
def user_view(request):
    user_id = request.GET['id']  # A002: Potential KeyError, use .get()
    user = User.objects.get(id=user_id)  # A003: Potential DoesNotExist exception
```

**Flask Analysis**:
```python
from flask import Flask, request

app = Flask(__name__)

@app.route('/user/<user_id>')
def get_user(user_id):
    # A004: SQL injection vulnerability
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return execute_query(query)
```

**NumPy/Pandas Analysis**:
```python
import numpy as np
import pandas as pd

# A005: Inefficient array operation
arr = np.array([1, 2, 3])
for i in range(len(arr)):
    arr[i] = arr[i] * 2  # Should use vectorized operation

# A006: Potential memory issue with large DataFrames
df = pd.read_csv('huge_file.csv')
df.apply(lambda x: expensive_operation(x))  # Consider chunking
```

### 5. Python Dynamic Analysis Simulation

**Python Runtime Behavior**:
- **Import-time Execution**: Side effects during module import
- **Memory Usage Patterns**: Large object creation, reference cycles
- **GIL Impact Analysis**: Thread-bound vs CPU-bound operations
- **Exception Propagation**: Unhandled exceptions across call stack
- **Performance Bottlenecks**: Loop inefficiencies, repeated calculations

**Dynamic Analysis Examples**:
```python
# Import-time side effects
print("Module loading...")  # D001: Side effect during import
DATABASE_URL = os.environ['DB_URL']  # D002: Missing env var at import

# Memory leak potential
class Node:
    def __init__(self, value):
        self.value = value
        self.children = []
        self.parent = None
    
    def add_child(self, child):
        child.parent = self  # D003: Potential circular reference
        self.children.append(child)

# Performance anti-pattern
def slow_search(items, target):
    for item in items:
        if expensive_check(item, target):  # D004: O(n²) complexity
            return item

# Thread safety issues
counter = 0
def increment():
    global counter
    counter += 1  # D005: Race condition in multithreading
```

## Python Project Configuration

### pyproject.toml Integration

```toml
[tool.claude-check]
python_version = "3.11"
target_versions = ["3.9", "3.10", "3.11"]

[tool.claude-check.analysis]
levels = ["syntax", "semantic", "type", "static", "dynamic"]
include_notebooks = true
check_tests = true

[tool.claude-check.type_checking]
mypy_integration = true
strict_mode = true
check_untyped_defs = true
warn_unused_ignores = true

[tool.claude-check.frameworks]
django = { version = "4.2", settings_module = "myproject.settings" }
pytest = { collect_tests = true, check_fixtures = true }

[tool.claude-check.style]
line_length = 88  # Black compatible
follow_pep8 = true
docstring_style = "google"  # google, numpy, sphinx

[tool.claude-check.security]
bandit_integration = true
check_hardcoded_secrets = true
scan_dependencies = true

[tool.claude-check.performance]
check_complexity = true
max_complexity = 10
detect_memory_leaks = true
profile_imports = true
```

### Virtual Environment Integration

```bash
# Automatic virtual environment detection
claude-code-check analyze --auto-venv

# Specific virtual environment
claude-code-check analyze --venv /path/to/venv

# Check dependency compatibility
claude-code-check deps-check requirements.txt

# Environment comparison
claude-code-check compare-envs dev.txt prod.txt
```

## Python-Specific Error Categories

### Python Syntax Errors (PY-E001 to PY-E099)

```python
# PY-E001: Indentation errors
def function():
print("Bad indentation")

# PY-E002: Invalid f-string syntax
name = "World"
greeting = f"Hello {name"  # Missing closing brace

# PY-E003: Invalid async/await usage
def regular_function():
    await some_coroutine()  # await outside async function

# PY-E004: Pattern matching syntax error (Python 3.10+)
match value:
    case 1, 2:  # Missing parentheses for tuple pattern
        pass
```

### Python Semantic Errors (PY-S001 to PY-S099)

```python
# PY-S001: Undefined variable
print(undefined_variable)

# PY-S002: Import not found
from nonexistent_module import something

# PY-S003: Circular import
# In module A: from module_b import func_b
# In module B: from module_a import func_a

# PY-S004: Invalid attribute access
class MyClass:
    pass

obj = MyClass()
print(obj.nonexistent_attr)  # AttributeError likely

# PY-S005: Incorrect magic method signature
class BadContainer:
    def __len__(self, extra_param):  # __len__ takes only self
        return 5
```

### Python Type Errors (PY-T001 to PY-T099)

```python
from typing import List, Optional, Union

# PY-T001: Type annotation mismatch
def add_numbers(a: int, b: int) -> int:
    return str(a + b)  # Returns str, not int

# PY-T002: Optional type not handled
def get_user_name(user: Optional[dict]) -> str:
    return user["name"]  # user might be None

# PY-T003: List type mismatch
numbers: List[int] = [1, 2, 3, "four"]  # str in int list

# PY-T004: Protocol not satisfied
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...

class Circle:
    def render(self) -> None: pass  # Missing draw() method

def display(shape: Drawable) -> None:
    shape.draw()

display(Circle())  # Protocol violation
```

### Python Static Analysis (PY-A001 to PY-A099)

```python
# PY-A001: Unused import
import os  # Never used

# PY-A002: Security vulnerability
password = "hardcoded_password"  # Hardcoded secret

# PY-A003: SQL injection risk
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return execute_query(query)

# PY-A004: Inefficient loop
items = [1, 2, 3, 4, 5]
result = []
for item in items:
    result.append(item * 2)  # Use list comprehension

# PY-A005: Missing error handling
def divide(a, b):
    return a / b  # ZeroDivisionError not handled

# PY-A006: Mutable default argument
def add_item(item, items=[]):  # Dangerous mutable default
    items.append(item)
    return items
```

### Python Dynamic Analysis (PY-D001 to PY-D099)

```python
# PY-D001: Potential memory leak
class Node:
    def __init__(self):
        self.parent = None
        self.children = []
    
    def add_child(self, child):
        child.parent = self  # Circular reference
        self.children.append(child)

# PY-D002: Import-time side effects
DATABASE_URL = os.environ['DATABASE_URL']  # May fail at import

# PY-D003: Thread safety issue
counter = 0
def increment():
    global counter
    temp = counter
    counter = temp + 1  # Race condition

# PY-D004: Resource leak
def process_file(filename):
    file = open(filename)  # File not closed
    return file.read()

# PY-D005: Infinite recursion risk
def factorial(n):
    return n * factorial(n - 1)  # No base case
```

## Framework-Specific Analysis

### Django Integration

```python
# Django-specific error detection
class UserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['password']  # PY-DJ001: Password field without widget

class UserView(View):
    def get(self, request, user_id):
        user = User.objects.get(id=user_id)  # PY-DJ002: DoesNotExist not handled
        return JsonResponse({'name': user.name})

# Settings validation
DEBUG = True  # PY-DJ003: Debug mode in production
ALLOWED_HOSTS = []  # PY-DJ004: Empty allowed hosts
```

### Flask Integration

```python
from flask import Flask, request

app = Flask(__name__)

# Flask-specific analysis
@app.route('/user')
def get_user():
    user_id = request.args['id']  # PY-FL001: KeyError if 'id' missing
    return f"User {user_id}"

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files['file']
    file.save(f"/uploads/{file.filename}")  # PY-FL002: Path traversal vulnerability
```

### FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    name: str
    age: int

@app.post("/users/")
async def create_user(user: User):
    # PY-FA001: Missing async database operation
    result = database.create_user(user)  # Should be await
    return result
```

### Data Science Libraries

```python
import pandas as pd
import numpy as np

# Pandas-specific analysis
def process_data(df):
    # PY-PD001: Inefficient iterrows usage
    for index, row in df.iterrows():
        df.at[index, 'new_col'] = row['col1'] * 2
    
    # PY-PD002: Memory-intensive operation
    df['large_col'] = df.apply(lambda x: expensive_operation(x), axis=1)

# NumPy-specific analysis
def matrix_operation(arr):
    # PY-NP001: Inefficient loop over array
    for i in range(len(arr)):
        arr[i] = arr[i] ** 2  # Use arr ** 2
```

## Testing Integration

### Pytest Integration

```python
# Test-specific analysis
def test_user_creation():
    user = create_user("John", 25)
    assert user.name == "John"  # PY-PT001: Use more specific assertions
    
def test_database_connection():
    # PY-PT002: Test depends on external resource
    conn = connect_to_production_db()
    assert conn.is_connected()

# Fixture validation
@pytest.fixture
def user_data():
    return {"name": "John"}  # PY-PT003: Consider using factory

def test_user_update(user_data):
    user_data["age"] = 30  # PY-PT004: Modifying fixture data
```

## Command Line Interface

### Python Project Analysis

```bash
# Full project analysis
claude-code-check analyze-python ./my_project

# Specific analysis levels
claude-code-check analyze-python ./my_project \
    --levels syntax,semantic,type \
    --include-tests \
    --check-notebooks

# Framework-specific analysis
claude-code-check analyze-python ./django_project \
    --framework django \
    --settings myproject.settings

# Virtual environment integration
claude-code-check analyze-python ./project \
    --venv ./venv \
    --check-dependencies

# Performance analysis
claude-code-check analyze-python ./project \
    --profile-imports \
    --memory-analysis \
    --complexity-check

# Security scan
claude-code-check security-scan ./project \
    --check-dependencies \
    --scan-secrets \
    --check-permissions
```

### Jupyter Notebook Support

```bash
# Notebook analysis
claude-code-check analyze-notebook ./analysis.ipynb

# Batch notebook processing
claude-code-check analyze-notebooks ./notebooks/ \
    --check-execution-order \
    --detect-unused-cells \
    --validate-outputs

# Convert notebook issues to Python file format
claude-code-check notebook-to-python ./analysis.ipynb \
    --fix-issues \
    --output ./analysis_fixed.py
```

## Integration with Python Ecosystem

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: claude-code-check
        name: Claude Code Python Checker
        entry: claude-code-check analyze-python
        language: system
        types: [python]
        args: [--fix-auto, --fail-on-error]
```

### GitHub Actions Integration

```yaml
# .github/workflows/code-check.yml
name: Python Code Quality
on: [push, pull_request]

jobs:
  code-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Claude Code Checker
        run: pip install claude-code-checker
      
      - name: Run Python Analysis
        run: |
          claude-code-check analyze-python . \
            --format github-actions \
            --fail-on-error \
            --generate-report
```

### IDE Integration

#### VS Code Extension

```json
// settings.json
{
  "claude-code-checker.python.enabled": true,
  "claude-code-checker.python.analysisLevels": ["all"],
  "claude-code-checker.python.frameworks": ["django", "fastapi"],
  "claude-code-checker.python.realTimeChecking": true,
  "claude-code-checker.python.showInlineHints": true
}
```

#### PyCharm Plugin

```xml
<!-- plugin configuration -->
<component name="ClaudeCodeChecker">
  <option name="enableRealTimeAnalysis" value="true" />
  <option name="pythonFrameworks" value="django,flask" />
  <option name="integrationLevel" value="deep" />
</component>
```

## Performance Optimization for Python

### Analysis Caching

```python
# Intelligent caching system
class PythonProjectCache:
    def __init__(self):
        self.ast_cache = {}  # Cached AST representations
        self.import_graph = {}  # Module dependency graph
        self.type_info = {}  # Type annotation cache
    
    def invalidate_on_change(self, file_path):
        # Invalidate only affected modules
        affected_modules = self.get_dependents(file_path)
        for module in affected_modules:
            self.clear_cache(module)
```

### Incremental Analysis

```python
# Only analyze changed files and their dependents
def incremental_analysis(project_path, changed_files):
    dependency_graph = build_import_graph(project_path)
    
    files_to_analyze = set(changed_files)
    for changed_file in changed_files:
        # Add all files that import the changed file
        files_to_analyze.update(
            dependency_graph.get_dependents(changed_file)
        )
    
    return analyze_files(files_to_analyze)
```

## Error Reporting for Python Projects

### Detailed Python Error Report

```json
{
  "project_info": {
    "name": "my-python-project",
    "python_version": "3.11.2",
    "virtual_env": "/home/user/venvs/myproject",
    "frameworks": ["django==4.2.1", "celery==5.2.7"],
    "total_files": 45,
    "total_lines": 12500
  },
  "analysis_summary": {
    "syntax_errors": 2,
    "semantic_errors": 8,
    "type_errors": 15,
    "static_issues": 23,
    "dynamic_warnings": 12,
    "security_issues": 3
  },
  "errors": [
    {
      "type": "type_error",
      "code": "PY-T001",
      "severity": "error",
      "file": "src/models.py",
      "line": 45,
      "column": 12,
      "message": "Argument 1 to 'save' has incompatible type 'str'; expected 'int'",
      "context": {
        "function": "update_user_age",
        "class": "User",
        "method_signature": "def save(self, age: int) -> None"
      },
      "python_specific": {
        "type_hint": "age: int",
        "actual_type": "str",
        "duck_typing_compatible": false
      },
      "suggestion": {
        "description": "Convert string to integer before passing",
        "fix": "user.save(int(age_string))",
        "confidence": 0.95,
        "alternatives": [
          "Add type validation: if isinstance(age, str): age = int(age)",
          "Update type hint to Union[int, str]"
        ]
      }
    }
  ],
  "framework_specific": {
    "django": {
      "models_analyzed": 12,
      "views_analyzed": 18,
      "common_issues": [
        "Missing DoesNotExist exception handling",
        "N+1 query problems detected"
      ]
    }
  },
  "performance_insights": {
    "import_time": "2.3s",
    "memory_usage": "45MB",
    "complexity_hotspots": [
      {
        "file": "src/algorithms.py",
        "function": "complex_calculation",
        "complexity": 15,
        "suggestion": "Consider breaking into smaller functions"
      }
    ]
  },
  "security_summary": {
    "hardcoded_secrets": 1,
    "sql_injection_risks": 2,
    "pickle_usage": 0,
    "eval_usage": 1
  }
}
```

This Python-focused specification provides comprehensive error detection tailored specifically to Python's unique characteristics, ecosystem, and common development patterns. It integrates deeply with Python tools and frameworks while maintaining the multi-layered analysis approach.