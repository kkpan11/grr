#!/usr/bin/env python
"""CLI utils."""

import argparse
from collections.abc import Callable
import sys
from typing import Any, Optional


_ARG_PARSER = argparse.ArgumentParser(prog="devtool.sh")
_ARG_SUBPARSERS = _ARG_PARSER.add_subparsers()


def subcommand(
    help: str,  # pylint: disable=redefined-builtin
    args: Optional[dict[str, dict[str, Any]]] = None,
) -> Callable[[Callable[[argparse.Namespace], None]], Any]:
  """Subcommand decorator.

  Devenv subcommands are defined as functions decorated by this decorator.
  CLI parsing is handled via the standard argparse Python module. As such, the
  parameters of this decorator are passed through to argparse.

  Args:
    help: Subcommand help text. This will be passed to add_parser().
    args: A dictionary of subcommand arguments. Each item (key, value) in this
      dictionary will generate a call to add_argument(key, **value).

  Returns:
    The decorated subcommand function.
  """
  args = args or {}

  def decorator(cmd_fn: Callable[[argparse.Namespace], None]) -> Any:
    parser = _ARG_SUBPARSERS.add_parser(cmd_fn.__name__, help=help)
    parser.set_defaults(func=cmd_fn)
    for name, params in args.items():  # type: ignore
      parser.add_argument(name, **params)  # type: ignore
    return cmd_fn

  return decorator


def parse_args() -> argparse.Namespace:
  """Parse command line arguments."""
  # Parse only args up to "--". Anything after that is stored/returned verbatim
  # in the namespace object, as `fwd_args`.
  try:
    sep_index = sys.argv.index("--")
  except ValueError:
    sep_index = len(sys.argv)
  local_args = sys.argv[1:sep_index]
  fwd_args = sys.argv[sep_index + 1 :]

  ns = _ARG_PARSER.parse_args(args=local_args)
  ns.fwd_args = fwd_args
  return ns
