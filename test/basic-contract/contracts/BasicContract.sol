pragma solidity ^0.7.5; 

contract BasicContract { 
    uint public x; 
    constructor(uint _x) public {
        x = _x;
    }
    function setX(uint _x) external { 
        x = _x + 8; 
    }
}
