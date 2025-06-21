# api/advanced_math_tools.py - Herramientas matemáticas avanzadas para agentes
import numpy as np
import pandas as pd
import scipy.stats as stats
import scipy.optimize as optimize
from scipy import interpolate
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.preprocessing import PolynomialFeatures
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

class AdvancedMathTools:
    """Herramientas matemáticas avanzadas para análisis financiero y proyecciones"""
    
    def __init__(self):
        self.name = "advanced_math_tools"
        self.description = "Herramientas avanzadas de cálculo matemático, simulaciones Monte Carlo y análisis estadístico"

    # ================== SIMULACIONES MONTE CARLO ==================

    def monte_carlo_stock_price(self, initial_price: float, days: int, mu: float = 0.1, 
                               sigma: float = 0.2, simulations: int = 1000):
        """
        Simulación Monte Carlo para precios de acciones usando movimiento browniano geométrico
        """
        dt = 1/252  # Fracción de año por día de trading
        prices = np.zeros((simulations, days + 1))
        prices[:, 0] = initial_price
        
        for t in range(1, days + 1):
            z = np.random.standard_normal(simulations)
            prices[:, t] = prices[:, t-1] * np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z)
        
        return {
            'final_prices': prices[:, -1],
            'mean_final_price': np.mean(prices[:, -1]),
            'std_final_price': np.std(prices[:, -1]),
            'confidence_95': np.percentile(prices[:, -1], [2.5, 97.5]),
            'all_paths': prices
        }

    def monte_carlo_portfolio_var(self, returns: np.array, weights: np.array, 
                                 confidence_level: float = 0.05, simulations: int = 10000):
        """
        Value at Risk (VaR) usando simulación Monte Carlo
        """
        portfolio_returns = []
        
        for _ in range(simulations):
            # Generar retornos aleatorios basados en distribución histórica
            random_returns = np.random.choice(returns, size=len(weights))
            portfolio_return = np.dot(weights, random_returns)
            portfolio_returns.append(portfolio_return)
        
        portfolio_returns = np.array(portfolio_returns)
        var = np.percentile(portfolio_returns, confidence_level * 100)
        cvar = np.mean(portfolio_returns[portfolio_returns <= var])
        
        return {
            'var': var,
            'cvar': cvar,
            'mean_return': np.mean(portfolio_returns),
            'std_return': np.std(portfolio_returns),
            'simulated_returns': portfolio_returns
        }

    # ================== ANÁLISIS DE REGRESIÓN ==================

    def polynomial_regression(self, x_data: list, y_data: list, degree: int = 2):
        """
        Regresión polinómica con validación cruzada
        """
        x = np.array(x_data).reshape(-1, 1)
        y = np.array(y_data)
        
        # Crear características polinómicas
        poly_features = PolynomialFeatures(degree=degree)
        x_poly = poly_features.fit_transform(x)
        
        # Dividir datos para validación
        x_train, x_test, y_train, y_test = train_test_split(x_poly, y, test_size=0.2, random_state=42)
        
        # Entrenar modelo
        model = LinearRegression()
        model.fit(x_train, y_train)
        
        # Predicciones
        y_pred_train = model.predict(x_train)
        y_pred_test = model.predict(x_test)
        
        # Métricas
        r2_train = r2_score(y_train, y_pred_train)
        r2_test = r2_score(y_test, y_pred_test)
        mse_test = mean_squared_error(y_test, y_pred_test)
        
        return {
            'model': model,
            'polynomial_features': poly_features,
            'r2_train': r2_train,
            'r2_test': r2_test,
            'mse_test': mse_test,
            'coefficients': model.coef_,
            'intercept': model.intercept_
        }

    def multiple_regression_analysis(self, x_data: np.array, y_data: np.array, 
                                   regularization: str = 'none', alpha: float = 1.0):
        """
        Análisis de regresión múltiple con opciones de regularización
        """
        x = np.array(x_data)
        y = np.array(y_data)
        
        # Seleccionar modelo según regularización
        if regularization == 'ridge':
            model = Ridge(alpha=alpha)
        elif regularization == 'lasso':
            model = Lasso(alpha=alpha)
        else:
            model = LinearRegression()
        
        # Entrenar modelo
        model.fit(x, y)
        y_pred = model.predict(x)
        
        # Estadísticas
        r2 = r2_score(y, y_pred)
        mse = mean_squared_error(y, y_pred)
        
        # Intervalos de confianza (aproximados)
        residuals = y - y_pred
        mse_residual = np.mean(residuals**2)
        
        return {
            'model': model,
            'r2_score': r2,
            'mse': mse,
            'coefficients': model.coef_ if hasattr(model, 'coef_') else None,
            'intercept': model.intercept_ if hasattr(model, 'intercept_') else None,
            'predictions': y_pred,
            'residuals': residuals,
            'residual_std': np.sqrt(mse_residual)
        }

    # ================== PROYECCIONES FINANCIERAS ==================

    def exponential_smoothing_forecast(self, data: list, periods_ahead: int = 12, 
                                     alpha: float = 0.3):
        """
        Proyección usando suavizado exponencial
        """
        data = np.array(data)
        n = len(data)
        
        # Suavizado exponencial simple
        smoothed = np.zeros(n)
        smoothed[0] = data[0]
        
        for i in range(1, n):
            smoothed[i] = alpha * data[i] + (1 - alpha) * smoothed[i-1]
        
        # Proyección
        forecast = []
        last_smooth = smoothed[-1]
        
        for _ in range(periods_ahead):
            forecast.append(last_smooth)
        
        return {
            'historical_smoothed': smoothed,
            'forecast': forecast,
            'alpha': alpha
        }

    def trend_projection(self, data: list, periods_ahead: int = 12, method: str = 'linear'):
        """
        Proyecciones basadas en tendencias
        """
        data = np.array(data)
        x = np.arange(len(data))
        
        if method == 'linear':
            # Regresión lineal
            coeffs = np.polyfit(x, data, 1)
            trend_func = np.poly1d(coeffs)
        elif method == 'exponential':
            # Ajuste exponencial
            def exp_func(x, a, b):
                return a * np.exp(b * x)
            
            try:
                popt, _ = optimize.curve_fit(exp_func, x, data)
                trend_func = lambda x: exp_func(x, *popt)
            except:
                # Fallback a linear si exponencial falla
                coeffs = np.polyfit(x, data, 1)
                trend_func = np.poly1d(coeffs)
        
        # Generar proyecciones
        future_x = np.arange(len(data), len(data) + periods_ahead)
        projections = [trend_func(i) for i in future_x]
        
        # Calcular intervalos de confianza
        residuals = data - [trend_func(i) for i in x]
        std_error = np.std(residuals)
        
        upper_bound = [p + 1.96 * std_error for p in projections]
        lower_bound = [p - 1.96 * std_error for p in projections]
        
        return {
            'projections': projections,
            'upper_confidence': upper_bound,
            'lower_confidence': lower_bound,
            'std_error': std_error,
            'method': method
        }

    # ================== OPTIMIZACIÓN DE PORTAFOLIOS ==================

    def markowitz_optimization(self, expected_returns: list, cov_matrix: list, 
                              risk_tolerance: float = 1.0):
        """
        Optimización de portafolio según teoría de Markowitz
        """
        returns = np.array(expected_returns)
        cov_matrix = np.array(cov_matrix)
        n_assets = len(returns)
        
        # Función objetivo: maximizar utilidad (retorno - riesgo*tolerancia)
        def objective(weights):
            portfolio_return = np.dot(weights, returns)
            portfolio_risk = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            return -(portfolio_return - risk_tolerance * portfolio_risk)
        
        # Restricciones
        constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})  # Suma = 1
        bounds = tuple((0, 1) for _ in range(n_assets))  # Pesos entre 0 y 1
        
        # Optimización
        result = optimize.minimize(
            objective, 
            x0=np.ones(n_assets) / n_assets,  # Pesos iniciales iguales
            method='SLSQP',
            bounds=bounds,
            constraints=constraints
        )
        
        optimal_weights = result.x
        optimal_return = np.dot(optimal_weights, returns)
        optimal_risk = np.sqrt(np.dot(optimal_weights.T, np.dot(cov_matrix, optimal_weights)))
        sharpe_ratio = optimal_return / optimal_risk if optimal_risk > 0 else 0
        
        return {
            'optimal_weights': optimal_weights,
            'expected_return': optimal_return,
            'expected_risk': optimal_risk,
            'sharpe_ratio': sharpe_ratio,
            'optimization_success': result.success
        }

    def efficient_frontier(self, expected_returns: list, cov_matrix: list, n_points: int = 100):
        """
        Calcula la frontera eficiente
        """
        returns = np.array(expected_returns)
        cov_matrix = np.array(cov_matrix)
        n_assets = len(returns)
        
        # Rango de retornos objetivo
        min_return = np.min(returns)
        max_return = np.max(returns)
        target_returns = np.linspace(min_return, max_return, n_points)
        
        efficient_risks = []
        efficient_weights = []
        
        for target_return in target_returns:
            # Minimizar riesgo para retorno objetivo
            def objective(weights):
                return np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},  # Suma = 1
                {'type': 'eq', 'fun': lambda x: np.dot(x, returns) - target_return}  # Retorno objetivo
            ]
            
            bounds = tuple((0, 1) for _ in range(n_assets))
            
            result = optimize.minimize(
                objective,
                x0=np.ones(n_assets) / n_assets,
                method='SLSQP',
                bounds=bounds,
                constraints=constraints
            )
            
            if result.success:
                efficient_risks.append(result.fun)
                efficient_weights.append(result.x)
            else:
                efficient_risks.append(np.nan)
                efficient_weights.append(np.full(n_assets, np.nan))
        
        return {
            'target_returns': target_returns,
            'efficient_risks': efficient_risks,
            'efficient_weights': efficient_weights
        }

    # ================== ANÁLISIS ESTADÍSTICO ==================

    def comprehensive_statistics(self, data: list, confidence_level: float = 0.95):
        """
        Análisis estadístico completo
        """
        data = np.array(data)
        n = len(data)
        
        # Estadísticas descriptivas
        mean = np.mean(data)
        median = np.median(data)
        std = np.std(data, ddof=1)
        variance = np.var(data, ddof=1)
        skewness = stats.skew(data)
        kurtosis = stats.kurtosis(data)
        
        # Percentiles
        q1 = np.percentile(data, 25)
        q3 = np.percentile(data, 75)
        iqr = q3 - q1
        
        # Intervalos de confianza
        alpha = 1 - confidence_level
        t_stat = stats.t.ppf(1 - alpha/2, n-1)
        margin_error = t_stat * (std / np.sqrt(n))
        ci_lower = mean - margin_error
        ci_upper = mean + margin_error
        
        # Pruebas de normalidad
        shapiro_stat, shapiro_p = stats.shapiro(data)
        
        # Detección de outliers (método IQR)
        outlier_threshold = 1.5 * iqr
        outliers = data[(data < q1 - outlier_threshold) | (data > q3 + outlier_threshold)]
        
        return {
            'descriptive_stats': {
                'count': n,
                'mean': mean,
                'median': median,
                'std': std,
                'variance': variance,
                'min': np.min(data),
                'max': np.max(data),
                'range': np.max(data) - np.min(data)
            },
            'distribution_stats': {
                'skewness': skewness,
                'kurtosis': kurtosis,
                'q1': q1,
                'q3': q3,
                'iqr': iqr
            },
            'confidence_interval': {
                'level': confidence_level,
                'lower': ci_lower,
                'upper': ci_upper,
                'margin_error': margin_error
            },
            'normality_test': {
                'shapiro_stat': shapiro_stat,
                'shapiro_p_value': shapiro_p,
                'is_normal': shapiro_p > 0.05
            },
            'outliers': {
                'count': len(outliers),
                'values': outliers.tolist(),
                'percentage': len(outliers) / n * 100
            }
        }

    def correlation_analysis(self, data_matrix: list):
        """
        Análisis de correlación entre múltiples variables
        """
        data = np.array(data_matrix)
        
        # Matriz de correlación
        corr_matrix = np.corrcoef(data)
        
        # Análisis de significancia
        n_vars = data.shape[0]
        p_values = np.zeros((n_vars, n_vars))
        
        for i in range(n_vars):
            for j in range(n_vars):
                if i != j:
                    _, p_val = stats.pearsonr(data[i], data[j])
                    p_values[i, j] = p_val
        
        return {
            'correlation_matrix': corr_matrix,
            'p_values': p_values,
            'significant_correlations': p_values < 0.05
        }

# Instancia global para uso en tools.py
advanced_math = AdvancedMathTools()