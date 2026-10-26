PYTHON ?= python3

.PHONY: help ml-install train forecast ml-test ml-lint

help:
	@echo "make ml-install   install forecasting dependencies (LightGBM, pandas, pytest, ruff)"
	@echo "make train        rolling-origin backtest -> ml/reports/metrics.md and metrics.json"
	@echo "make forecast     train on the sample history, write ml/forecast.csv (next 14 days)"
	@echo "make ml-test      run the forecasting tests"
	@echo "make ml-lint      lint the forecasting code"

ml-install:
	$(PYTHON) -m pip install -r ml/requirements-dev.txt

train:
	cd ml && $(PYTHON) -m stocksense_ml backtest --engine lightgbm --out reports

forecast:
	cd ml && $(PYTHON) -m stocksense_ml forecast --out forecast.csv

ml-test:
	cd ml && $(PYTHON) -m pytest

ml-lint:
	cd ml && ruff check .
