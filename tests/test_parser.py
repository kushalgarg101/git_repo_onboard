"""Tests for the parser module — covers Python, JS/TS, Rust, Go, Java, C/C++."""

import pathlib
import tempfile
import textwrap

import pytest

from github_viz.analysis.parser import parse_file, parse_files


def _write_tmp(code: str, suffix: str) -> pathlib.Path:
    f = tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False, encoding="utf-8")
    f.write(textwrap.dedent(code))
    f.close()
    return pathlib.Path(f.name)


class TestPythonParser:
    def test_imports(self):
        p = _write_tmp("import os\nfrom pathlib import Path\nimport sys, json\n", ".py")
        pf = parse_file(p)
        assert pf.language == "py"
        assert len(pf.imports) >= 3  # os, pathlib, sys, json

    def test_class_and_func(self):
        code = """\
        class Foo:
            def bar(self):
                pass

        def baz():
            if True:
                for x in []:
                    pass
        """
        pf = parse_file(_write_tmp(code, ".py"))
        assert "Foo" in pf.class_defs
        assert "bar" in pf.func_defs
        assert "baz" in pf.func_defs
        assert pf.complexity >= 3  # if + for + base

    def test_line_count(self):
        pf = parse_file(_write_tmp("a\nb\nc\n", ".py"))
        assert pf.line_count == 3

    def test_calls_deduplicated(self):
        code = "foo()\nfoo()\nbar()\n"
        pf = parse_file(_write_tmp(code, ".py"))
        assert pf.calls.count("foo") == 1


class TestJSTSParser:
    def test_imports(self):
        code = """\
        import React from 'react';
        import './styles.css';
        const fs = require('fs');
        """
        pf = parse_file(_write_tmp(code, ".js"))
        assert pf.language == "js"
        assert len(pf.imports) == 3

    def test_arrow_functions(self):
        code = """\
        function greet() {}
        const add = (a, b) => a + b;
        export const multiply = async (x) => x;
        """
        pf = parse_file(_write_tmp(code, ".js"))
        assert "greet" in pf.func_defs
        assert "add" in pf.func_defs
        assert "multiply" in pf.func_defs

    def test_ts_file(self):
        pf = parse_file(_write_tmp("const x = 1;\n", ".ts"))
        assert pf.language == "ts"


class TestRustParser:
    def test_basics(self):
        code = """\
        use std::io;
        struct Point { x: f64, y: f64 }
        pub fn main() {
            if true { }
        }
        """
        pf = parse_file(_write_tmp(code, ".rs"))
        assert pf.language == "rs"
        assert len(pf.imports) == 1
        assert "Point" in pf.class_defs
        assert "main" in pf.func_defs
        assert pf.complexity >= 2


class TestGoParser:
    def test_basics(self):
        code = """\
        package main

        import "fmt"

        type Server struct {
            Port int
        }

        func main() {
            if true {
                for i := 0; i < 10; i++ {}
            }
        }
        """
        pf = parse_file(_write_tmp(code, ".go"))
        assert pf.language == "go"
        assert len(pf.imports) == 1
        assert "Server" in pf.class_defs
        assert "main" in pf.func_defs
        assert pf.complexity >= 3

    def test_multi_import(self):
        code = """\
        import (
            "fmt"
            "os"
            log "log"
        )
        """
        pf = parse_file(_write_tmp(code, ".go"))
        assert len(pf.imports) == 3


class TestJavaParser:
    def test_basics(self):
        code = """\
        import java.util.List;
        import java.io.File;

        public class Main {
            public static void main(String[] args) {
                if (true) {}
            }
        }
        """
        pf = parse_file(_write_tmp(code, ".java"))
        assert pf.language == "java"
        assert len(pf.imports) == 2
        assert "Main" in pf.class_defs
        assert "main" in pf.func_defs


class TestCCppParser:
    def test_c_file(self):
        code = """\
        #include <stdio.h>
        #include "myheader.h"

        struct Point {
            int x;
        };

        int main() {
            if (1) {}
            while (0) {}
        }
        """
        pf = parse_file(_write_tmp(code, ".c"))
        assert pf.language == "c"
        assert len(pf.imports) == 2
        assert "Point" in pf.class_defs
        assert "main" in pf.func_defs
        assert pf.complexity >= 3

    def test_cpp_file(self):
        pf = parse_file(_write_tmp("#include <iostream>\n", ".cpp"))
        assert pf.language == "cpp"


class TestParseFiles:
    def test_multiple(self):
        p1 = _write_tmp("import os\n", ".py")
        p2 = _write_tmp("import React from 'react';\n", ".js")
        results = parse_files([p1, p2])
        assert len(results) == 2
