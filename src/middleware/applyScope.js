exports.applyScope = (baseQuery, req) => {
  if (req.user.role === "Admin")
    return { query: baseQuery, params: [] };

  if (req.user.role === "Regional Officer")
    return {
      query: baseQuery + " WHERE region_id = $1",
      params: [req.user.region_id]
    };

  if (req.user.role === "District Officer")
    return {
      query: baseQuery + " WHERE district_id = $1",
      params: [req.user.district_id]
    };

  throw new Error("Access denied");
};
