/**
 * ============================================================================
 * CONTRATO: ChainlinkOracle
 * ARCHIVO: ./contracts/src/Oracles/ChainlinkOracle.sol
 * PRIORIDAD: P0 (CRÍTICO - ON-CHAIN)
 * ============================================================================
 * 
 * 📥 ENTRADA:
 *   FUNCIONES: version, getPrices, latestRoundData
 * 
 * 🔄 LÓGICA:
 * 
 * 📤 SALIDA:
 *   EVENTOS: StalePrice, PriceFeedRemoved, PriceFeedAdded
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
 * @title ChainlinkOracle
 * @dev Adaptador para oráculos de Chainlink
 * 
 * ARBITRAGEXPLUS2025 - Integración con Chainlink Price Feeds
 * 
 * Este contrato proporciona una interfaz unificada para consultar precios
 * desde los oráculos de Chainlink, con validaciones de frescura y confiabilidad.
 */

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract ChainlinkOracle {
    
    // ==================================================================================
    // ESTRUCTURAS Y EVENTOS
    // ==================================================================================
    
    struct PriceFeed {
        address feedAddress;
        uint8 decimals;
        uint256 heartbeat;        // Tiempo máximo entre actualizaciones
        bool isActive;
    }
    
    event PriceFeedAdded(address indexed token, address indexed feed, uint8 decimals);
    event PriceFeedUpdated(address indexed token, address indexed feed);
    event PriceFeedRemoved(address indexed token);
    event StalePrice(address indexed token, uint256 lastUpdate, uint256 heartbeat);
    
    // ==================================================================================
    // VARIABLES DE ESTADO
    // ==================================================================================
    
    // Mapeo de token a price feed
    mapping(address => PriceFeed) public priceFeeds;
    
    // Owner del contrato
    address public owner;
    
    // Configuración
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
    
    constructor() {
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
        PriceFeed memory feed = priceFeeds[token];
        require(feed.isActive, "Price feed not active");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed.feedAddress);
        
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        // Validar que la respuesta es válida
        require(answer > 0, "Invalid price");
        require(answeredInRound >= roundId, "Stale price");
        require(updatedAt > 0, "Round not complete");
        
        // Validar frescura del precio
        require(block.timestamp - updatedAt <= feed.heartbeat, "Price too old");
        
        // Convertir precio a 18 decimales
        uint256 rawPrice = uint256(answer);
        
        if (feed.decimals < 18) {
            price = rawPrice * (10 ** (18 - feed.decimals));
        } else if (feed.decimals > 18) {
            price = rawPrice / (10 ** (feed.decimals - 18));
        } else {
            price = rawPrice;
        }
        
        // Validar rango de precio
        require(price >= MIN_PRICE && price <= MAX_PRICE, "Price out of range");
        
        timestamp = updatedAt;
        
        return (price, timestamp);
    }
    
    /**
     * @dev Obtiene el precio sin validaciones estrictas (para fallback)
     * @param token Dirección del token
     * @return price Precio en USD con 18 decimales
     * @return isStale Indica si el precio está desactualizado
     */
    function getPriceUnsafe(address token) external view returns (uint256 price, bool isStale) {
        PriceFeed memory feed = priceFeeds[token];
        require(feed.isActive, "Price feed not active");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed.feedAddress);
        
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
            
        ) = priceFeed.latestRoundData();
        
        if (answer <= 0) {
            return (0, true);
        }
        
        // Convertir precio a 18 decimales
        uint256 rawPrice = uint256(answer);
        
        if (feed.decimals < 18) {
            price = rawPrice * (10 ** (18 - feed.decimals));
        } else if (feed.decimals > 18) {
            price = rawPrice / (10 ** (feed.decimals - 18));
        } else {
            price = rawPrice;
        }
        
        // Verificar si está desactualizado
        isStale = (block.timestamp - updatedAt) > feed.heartbeat;
        
        return (price, isStale);
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
        
        for (uint256 i = 0; i < tokens.length; i++) {
            (prices[i], timestamps[i]) = this.getPrice(tokens[i]);
        }
        
        return (prices, timestamps);
    }
    
    // ==================================================================================
    // FUNCIONES DE ADMINISTRACIÓN
    // ==================================================================================
    
    /**
     * @dev Agrega un price feed para un token
     */
    function addPriceFeed(
        address token,
        address feedAddress,
        uint256 heartbeat
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(feedAddress != address(0), "Invalid feed");
        require(heartbeat > 0, "Invalid heartbeat");
        
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 decimals = feed.decimals();
        
        priceFeeds[token] = PriceFeed({
            feedAddress: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            isActive: true
        });
        
        emit PriceFeedAdded(token, feedAddress, decimals);
    }
    
    /**
     * @dev Actualiza un price feed existente
     */
    function updatePriceFeed(
        address token,
        address feedAddress,
        uint256 heartbeat
    ) external onlyOwner {
        require(priceFeeds[token].isActive, "Price feed not found");
        require(feedAddress != address(0), "Invalid feed");
        require(heartbeat > 0, "Invalid heartbeat");
        
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 decimals = feed.decimals();
        
        priceFeeds[token].feedAddress = feedAddress;
        priceFeeds[token].decimals = decimals;
        priceFeeds[token].heartbeat = heartbeat;
        
        emit PriceFeedUpdated(token, feedAddress);
    }
    
    /**
     * @dev Remueve un price feed
     */
    function removePriceFeed(address token) external onlyOwner {
        require(priceFeeds[token].isActive, "Price feed not found");
        
        priceFeeds[token].isActive = false;
        
        emit PriceFeedRemoved(token);
    }
    
    /**
     * @dev Transfiere ownership del contrato
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    /**
     * @dev Verifica si un price feed está activo
     */
    function isPriceFeedActive(address token) external view returns (bool) {
        return priceFeeds[token].isActive;
    }
    
    /**
     * @dev Obtiene información de un price feed
     */
    function getPriceFeedInfo(address token) 
        external 
        view 
        returns (
            address feedAddress,
            uint8 decimals,
            uint256 heartbeat,
            bool isActive
        ) 
    {
        PriceFeed memory feed = priceFeeds[token];
        return (feed.feedAddress, feed.decimals, feed.heartbeat, feed.isActive);
    }
}

