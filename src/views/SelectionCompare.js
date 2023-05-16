import ReactJsonViewCompare from "react-json-view-compare";

import React, { useEffect, useState } from "react";

const SelectionCompare = (props) => {
  return (
    <div>
      <ReactJsonViewCompare oldData={props.oldData} newData={props.newData} />
    </div>
  );
};

export default SelectionCompare;
