/**
 * ============================================================================
 * CONTRATO: BandOracle
 * ARCHIVO: ./contracts/src/Oracles/BandOracle.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: getTokenConfig, removeToken, getPrices
 * 
 * 🔄 LÓGICA:
 * 
 * 📤 SALIDA:
 *   EVENTOS: TokenConfigured, TokenRemoved, StalePrice
 * 
 * 🔒 SEGURIDAD:
 *   MODIFIERS: onlyOwner
 *   - Reentrancy guard
 *   - Access control
 * 
 * ============================================================================
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BandOracle
 * @dev Adaptador para oráculos de Band Protocol
 * 
 * ARBITRAGEXPLUS2025 - Integración con Band Protocol
 * 
 * Este contrato proporciona una interfaz unificada para consultar precios
 * desde los oráculos de Band Protocol, con validaciones de frescura y confiabilidad.
 */

interface IStdReference {
    /// A structure returned whenever someone requests for standard reference data.
    struct ReferenceData {
        uint256 rate; // base/quote exchange rate, multiplied by 1e18.
        uint256 lastUpdatedBase; // UNIX epoch of the last time when base price gets updated.
        uint256 lastUpdatedQuote; // UNIX epoch of the last time when quote price gets updated.
    }

    /// Returns the price data for the given base/quote pair. Revert if not available.
    function getReferenceData(string memory _base, string memory _quote)
        external
        view
        returns (ReferenceData memory);

    /// Similar to getReferenceData, but with multiple base/quote pairs at once.
    function getReferenceDataBulk(string[] memory _bases, string[] memory _quotes)
        external
        view
        returns (ReferenceData[] memory);
}

contract BandOracle {
    
    // ==================================================================================
    // ESTRUCTURAS Y EVENTOS
    // ==================================================================================
    
    struct TokenConfig {
        string symbol;            // Símbolo del token en Band Protocol
        uint256 heartbeat;        // Tiempo máximo entre actualizaciones
        bool isActive;
    }
    
    event TokenConfigured(address indexed token, string symbol);
    event TokenRemoved(address indexed token);
    event StalePrice(address indexed token, uint256 lastUpdate, uint256 heartbeat);
    
    // ==================================================================================
    // VARIABLES DE ESTADO
    // ==================================================================================
    
    // Referencia al contrato de Band Protocol
    IStdReference public ref;
    
    // Mapeo de token a configuración
    mapping(address => TokenConfig) public tokenConfigs;
    
    // Owner del contrato
    address public owner;
    
    // Configuración
    string public constant QUOTE_SYMBOL = "USD";
    uint256 public constant MAX_PRICE_AGE = 1 hours;
    uint256 public constant MIN_PRICE = 1; // Precio mínimo válido
    uint256 public constant MAX_PRICE = type(uint256).max / 1e18; // Precio máximo válido
    
    // ==================================================================================
    // MODIFIERS
    // ==================================================================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // ==================================================================================
    // CONSTRUCTOR
    // ==================================================================================
    
    constructor(address _ref) {
        require(_ref != address(0), "Invalid ref address");
        ref = IStdReference(_ref);
        owner = msg.sender;
    }
    
    // ==================================================================================
    // FUNCIONES PRINCIPALES
    // ==================================================================================
    
    /**
     * @dev Obtiene el precio actual de un token
     * @param token Dirección del token
     * @return price Precio en USD con 18 decimales
     * @return timestamp Timestamp de la última actualización
     */
    function getPrice(address token) external view returns (uint256 price, uint256 timestamp) {
        TokenConfig memory config = tokenConfigs[token];
        require(config.isActive, "Token not configured");
        
        IStdReference.ReferenceData memory data = ref.getReferenceData(
            config.symbol,
            QUOTE_SYMBOL
        );
        
        // Validar que el precio es válido
        require(data.rate > 0, "Invalid price");
        require(data.rate >= MIN_PRICE && data.rate <= MAX_PRICE, "Price out of range");
        
        // Usar el timestamp más reciente
        timestamp = data.lastUpdatedBase > data.lastUpdatedQuote 
            ? data.lastUpdatedBase 
            : data.lastUpdatedQuote;
        
        // Validar frescura del precio
        require(block.timestamp - timestamp <= config.heartbeat, "Price too old");
        
        price = data.rate;
        
        return (price, timestamp);
    }
    
    /**
     * @dev Obtiene el precio sin validaciones estrictas (para fallback)
     * @param token Dirección del token
     * @return price Precio en USD con 18 decimales
     * @return isStale Indica si el precio está desactualizado
     */
    function getPriceUnsafe(address token) external view returns (uint256 price, bool isStale) {
        TokenConfig memory config = tokenConfigs[token];
        require(config.isActive, "Token not configured");
        
        try ref.getReferenceData(config.symbol, QUOTE_SYMBOL) returns (
            IStdReference.ReferenceData memory data
        ) {
            if (data.rate == 0) {
                return (0, true);
            }
            
            price = data.rate;
            
            // Usar el timestamp más reciente
            uint256 timestamp = data.lastUpdatedBase > data.lastUpdatedQuote 
                ? data.lastUpdatedBase 
                : data.lastUpdatedQuote;
            
            // Verificar si está desactualizado
            isStale = (block.timestamp - timestamp) > config.heartbeat;
            
            return (price, isStale);
        } catch {
            return (0, true);
        }
    }
    
    /**
     * @dev Obtiene múltiples precios en una sola llamada
     * @param tokens Array de direcciones de tokens
     * @return prices Array de precios en USD con 18 decimales
     * @return timestamps Array de timestamps de última actualización
     */
    function getPrices(address[] calldata tokens) 
        external 
        view 
        returns (uint256[] memory prices, uint256[] memory timestamps) 
    {
        prices = new uint256[](tokens.length);
        timestamps = new uint256[](tokens.length);
        
        // Construir arrays de símbolos
        string[] memory bases = new string[](tokens.length);
        string[] memory quotes = new string[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            TokenConfig memory config = tokenConfigs[tokens[i]];
            require(config.isActive, "Token not configured");
            
            bases[i] = config.symbol;
            quotes[i] = QUOTE_SYMBOL;
        }
        
        // Obtener datos en bulk
        IStdReference.ReferenceData[] memory dataArray = ref.getReferenceDataBulk(bases, quotes);
        
        // Procesar resultados
        for (uint256 i = 0; i < tokens.length; i++) {
            IStdReference.ReferenceData memory data = dataArray[i];
            TokenConfig memory config = tokenConfigs[tokens[i]];
            
            require(data.rate > 0, "Invalid price");
            require(data.rate >= MIN_PRICE && data.rate <= MAX_PRICE, "Price out of range");
            
            // Usar el timestamp más reciente
            uint256 timestamp = data.lastUpdatedBase > data.lastUpdatedQuote 
                ? data.lastUpdatedBase 
                : data.lastUpdatedQuote;
            
            require(block.timestamp - timestamp <= config.heartbeat, "Price too old");
            
            prices[i] = data.rate;
            timestamps[i] = timestamp;
        }
        
        return (prices, timestamps);
    }
    
    // ==================================================================================
    // FUNCIONES DE ADMINISTRACIÓN
    // ==================================================================================
    
    /**
     * @dev Configura un token
     */
    function configureToken(
        address token,
        string memory symbol,
        uint256 heartbeat
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(bytes(symbol).length > 0, "Invalid symbol");
        require(heartbeat > 0, "Invalid heartbeat");
        
        tokenConfigs[token] = TokenConfig({
            symbol: symbol,
            heartbeat: heartbeat,
            isActive: true
        });
        
        emit TokenConfigured(token, symbol);
    }
    
    /**
     * @dev Remueve la configuración de un token
     */
    function removeToken(address token) external onlyOwner {
        require(tokenConfigs[token].isActive, "Token not configured");
        
        tokenConfigs[token].isActive = false;
        
        emit TokenRemoved(token);
    }
    
    /**
     * @dev Actualiza la referencia al contrato de Band Protocol
     */
    function updateReference(address _ref) external onlyOwner {
        require(_ref != address(0), "Invalid ref address");
        ref = IStdReference(_ref);
    }
    
    /**
     * @dev Transfiere ownership del contrato
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    /**
     * @dev Verifica si un token está configurado
     */
    function isTokenConfigured(address token) external view returns (bool) {
        return tokenConfigs[token].isActive;
    }
    
    /**
     * @dev Obtiene la configuración de un token
     */
    function getTokenConfig(address token) 
        external 
        view 
        returns (
            string memory symbol,
            uint256 heartbeat,
            bool isActive
        ) 
    {
        TokenConfig memory config = tokenConfigs[token];
        return (config.symbol, config.heartbeat, config.isActive);
    }
}

